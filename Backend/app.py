from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import mysql.connector
import re
import datetime
import google.generativeai as genai
import json
import logging

load_dotenv()  # Load environment variables from .env

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MySQL connection
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DB = os.getenv("MYSQL_DB", "quickCommerceDB")

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables")
else:
    genai.configure(api_key=GEMINI_API_KEY)

def get_db_connection():
    """Establishes and returns a MySQL database connection."""
    try:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB
        )
        return conn
    except mysql.connector.Error as err:
        print(f"Error connecting to MySQL: {err}")
        return None

def get_database_schema():
    """Get the complete database schema for context."""
    schema = """
DATABASE SCHEMA for quickCommerceDB:

1. darkstores table:
   - store_id (INT, PRIMARY KEY): Unique identifier for each darkstore
   - name (VARCHAR): Store name
   - location (VARCHAR): Store location/address
   - region (VARCHAR): Geographic region
   - contact_info (VARCHAR): Contact information

2. products table:
   - product_id (INT, PRIMARY KEY): Unique identifier for each product
   - name (VARCHAR): Product name
   - brand (VARCHAR): Product brand
   - barcode (VARCHAR): Product barcode
   - is_perishable (BOOLEAN): Whether product is perishable (1=yes, 0=no)
   - unit_of_measure (VARCHAR): Unit of measurement

3. inventory table:
   - inventory_id (INT, PRIMARY KEY): Unique inventory record identifier
   - product_id (INT): References products.product_id
   - store_id (INT): References darkstores.store_id
   - quantity_available (INT): Available stock quantity
   - quantity_reserved (INT): Reserved stock quantity
   - reorder_threshold (INT): Minimum stock level before reordering
   - last_updated (DATETIME): Last update timestamp

4. users table:
   - user_id (INT, PRIMARY KEY): Unique user identifier
   - name (VARCHAR): User full name
   - role (VARCHAR): User role (customer, staff, etc.)
   - store_id (INT): References darkstores.store_id (NULL for customers)
   - login_credentials (VARCHAR): Login username

5. orders table:
   - order_id (INT, PRIMARY KEY): Unique order identifier
   - customer_id (INT): References users.user_id
   - store_id (INT): References darkstores.store_id
   - order_timestamp (DATETIME): When order was placed
   - status (VARCHAR): Order status (pending, processing, shipped, delivered)
   - delivery_slot (VARCHAR): Delivery time slot

6. orderitems table:
   - order_item_id (INT, PRIMARY KEY): Unique order item identifier
   - order_id (INT): References orders.order_id
   - product_id (INT): References products.product_id
   - quantity (INT): Quantity ordered
   - unit_price (DECIMAL): Price per unit
   - discount (DECIMAL): Discount percentage (0.0 to 1.0)

7. stockmovements table:
   - movement_id (INT, PRIMARY KEY): Unique movement identifier
   - product_id (INT): References products.product_id
   - store_id (INT): References darkstores.store_id
   - type (VARCHAR): Movement type (inbound, outbound, adjustment)
   - quantity (INT): Quantity moved (positive for inbound, negative for outbound/adjustment)
   - timestamp (DATETIME): When movement occurred
   - reference (VARCHAR): Reference number or reason

RELATIONSHIPS:
- inventory.product_id → products.product_id
- inventory.store_id → darkstores.store_id
- orders.customer_id → users.user_id
- orders.store_id → darkstores.store_id
- orderitems.order_id → orders.order_id
- orderitems.product_id → products.product_id
- stockmovements.product_id → products.product_id
- stockmovements.store_id → darkstores.store_id
- users.store_id → darkstores.store_id (for staff only)
"""
    return schema

def is_safe_query(query):
    """
    Check if the generated query is safe to execute.
    This is a basic security check to prevent dangerous operations.
    """
    query_upper = query.upper().strip()
    
    # List of dangerous keywords/patterns
    dangerous_keywords = [
        'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE',
        'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL', 'LOAD_FILE', 'INTO OUTFILE',
        'INTO DUMPFILE', 'SHOW GRANTS', 'SHOW DATABASES', 'SHOW TABLES',
        'INFORMATION_SCHEMA', 'MYSQL', 'PERFORMANCE_SCHEMA'
    ]
    
    # Check for dangerous keywords
    for keyword in dangerous_keywords:
        if keyword in query_upper:
            return False, f"Query contains dangerous keyword: {keyword}"
    
    # Must start with SELECT
    if not query_upper.startswith('SELECT'):
        return False, "Only SELECT queries are allowed"
    
    # Check for suspicious patterns
    suspicious_patterns = [
        r'--',  # SQL comments
        r'/\*',  # SQL comments
        r'\*/',  # SQL comments
        r';.*SELECT',  # Multiple statements
        r'UNION.*SELECT',  # Potential injection
    ]
    
    for pattern in suspicious_patterns:
        if re.search(pattern, query_upper):
            return False, f"Query contains suspicious pattern: {pattern}"
    
    return True, "Query is safe"

def generate_sql_query(natural_language_query):
    """
    Use Gemini to generate SQL query from natural language.
    """
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        schema = get_database_schema()
        
        prompt = f"""
You are a SQL query generator for a darkstore inventory management system. 
Generate ONLY a valid MySQL SELECT query based on the user's natural language request.

{schema}

IMPORTANT RULES:
1. Generate ONLY SELECT queries - no INSERT, UPDATE, DELETE, DROP, etc.
2. Use proper JOIN syntax when accessing related tables
3. Use backticks around table and column names if they contain special characters
4. Return only the SQL query, no explanations or additional text
5. Ensure the query is syntactically correct for MySQL
6. Use appropriate WHERE clauses, ORDER BY, GROUP BY, HAVING as needed
7. For date/time comparisons, use proper MySQL date functions
8. Handle case-insensitive string matching with LIKE and % wildcards when appropriate
9. Give unformatted text. no ' or " or * for formatting. do not give anything in bolt, italics, underline or strike mark. Just plain text.

User's request: {natural_language_query}

Generate the SQL query:
"""
        
        response = model.generate_content(prompt)
        
        if response and response.text:
            sql_query = response.text.strip()
            # Remove any markdown formatting
            sql_query = sql_query.replace('sql', '').replace('', '').strip()
            print("CHECK CHECK:\n",sql_query)
            return sql_query
        else:
            return None
            
    except Exception as e:
        logger.error(f"Error generating SQL query: {str(e)}")
        return None

@app.route('/')
def index():
    return jsonify({"message": "Welcome to QuickCommerce API!"})

@app.route('/natural-query', methods=['POST'])
def natural_language_query():
    """
    Handle natural language queries and convert them to SQL.
    """
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "No query provided"}), 400
        
        natural_query = data['query'].strip()
        if not natural_query:
            return jsonify({"error": "Empty query provided"}), 400
        
        # Generate SQL query using Gemini
        sql_query = generate_sql_query(natural_query)
        if not sql_query:
            return jsonify({"error": "Failed to generate SQL query"}), 500
        
        # Security check
        is_safe, safety_message = is_safe_query(sql_query)
        if not is_safe:
            logger.warning(f"Unsafe query blocked: {sql_query}")
            print(safety_message)
            return jsonify({
                "error": f"Query blocked for security reasons: {safety_message}",
                "generated_sql": sql_query
            }), 400
        
        # Execute the query
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute(sql_query)
            results = cursor.fetchall()
            print(results)
            
            # Convert datetime objects to string for JSON serialization
            for item in results:
                for key, value in item.items():
                    if isinstance(value, datetime.datetime):
                        item[key] = value.isoformat()
                    elif isinstance(value, datetime.date):
                        item[key] = value.isoformat()
            
            return jsonify({
                "success": True,
                "natural_query": natural_query,
                "generated_sql": sql_query,
                "results": results,
                "row_count": len(results)
            })
            
        except mysql.connector.Error as err:
            logger.error(f"MySQL error executing query: {str(err)}")
            return jsonify({
                "error": f"Database error: {str(err)}",
                "generated_sql": sql_query
            }), 500
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Unexpected error in natural_language_query: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# New endpoint to get all tables and their content
@app.route('/all-tables', methods=['GET'])
def get_all_tables():
    tables = [
        "Products", 
        "DarkStores", 
        "Users", 
        "Inventory", 
        "StockMovements", 
        "Orders", 
        "OrderItems"
    ]
    
    all_data = {}
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    for table_name in tables:
        try:
            cursor.execute(f"SELECT * FROM {table_name}")
            items = cursor.fetchall()
            # Convert datetime objects to string for JSON serialization
            for item in items:
                for key, value in item.items():
                    if isinstance(value, datetime.datetime):
                        item[key] = value.isoformat()
            all_data[table_name] = items
        except mysql.connector.Error as err:
            print(f"Error fetching data from {table_name}: {err}")
            all_data[table_name] = []
    
    cursor.close()
    conn.close()
    return jsonify(all_data)

# Unified update endpoint for any table
@app.route('/update-row', methods=['PUT'])
def update_row():
    data = request.get_json()

    table_name = data.get('table_name')
    key = data.get('key')
    attribute_list = data.get('attribute_list')

    if not all([table_name, key, attribute_list]):
        return jsonify({"error": "Missing required fields"}), 400

    # Validate table name
    allowed_tables = ["Products", "DarkStores", "Users", "Inventory", 
                     "StockMovements", "Orders", "OrderItems"]
    if table_name not in allowed_tables:
        return jsonify({"error": "Invalid table name"}), 400

    # Map table to primary key
    key_field_map = {
        "Products": "product_id",
        "DarkStores": "store_id",
        "Users": "user_id",
        "Inventory": "inventory_id",
        "StockMovements": "movement_id",
        "Orders": "order_id",
        "OrderItems": "order_item_id"
    }
    key_field = key_field_map.get(table_name)
    
    # Validate attribute names
    pattern = re.compile(r'^[a-zA-Z0-9_]+$')
    for attr_name in attribute_list.keys():
        if not pattern.match(attr_name):
            return jsonify({"error": f"Invalid attribute name: {attr_name}"}), 400

    # Build update query
    set_clause = ", ".join([f"{k} = %s" for k in attribute_list.keys()])
    values = list(attribute_list.values())
    values.append(key)  # For WHERE clause

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor()
    query = f"UPDATE {table_name} SET {set_clause} WHERE {key_field} = %s"
    
    try:
        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"error": f"No {table_name} found with {key_field}={key}"}), 404
            
        return jsonify({
            "message": f"{table_name} updated successfully",
            "modified_count": cursor.rowcount
        })
    except mysql.connector.Error as err:
        return jsonify({"error": f"Database error: {str(err)}"}), 500
    finally:
        cursor.close()
        conn.close()

# -------------------- Utility --------------------
def create_routes(name, key_field):
    # Add document
    @app.route(f'/add-{name}', methods=['POST'], endpoint=f'add_{name}')
    def add():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor()
        
        try:
            # Build the insert query dynamically
            fields = list(data.keys())
            values = list(data.values())
            placeholders = ', '.join(['%s'] * len(fields))
            query = f"INSERT INTO {name} ({', '.join(fields)}) VALUES ({placeholders})"
            
            cursor.execute(query, values)
            conn.commit()
            
            return jsonify({
                "message": f"{name} added successfully",
                "id": cursor.lastrowid
            }), 201
            
        except mysql.connector.Error as err:
            return jsonify({"error": f"Database error: {str(err)}"}), 500
        finally:
            cursor.close()
            conn.close()

    # Get all documents
    @app.route(f'/get-{name}', methods=['GET'], endpoint=f'get_all_{name}')
    def get_all():
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute(f"SELECT * FROM {name}")
            items = cursor.fetchall()
            
            # Convert datetime objects to string for JSON serialization
            for item in items:
                for key, value in item.items():
                    if isinstance(value, datetime.datetime):
                        item[key] = value.isoformat()
            
            return jsonify(items)
            
        except mysql.connector.Error as err:
            return jsonify({"error": f"Database error: {str(err)}"}), 500
        finally:
            cursor.close()
            conn.close()

    # Delete by key
    @app.route(f'/delete-{name}/<id>', methods=['DELETE'], endpoint=f'delete_{name}')
    def delete(id):
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"DELETE FROM {name} WHERE {key_field} = %s", (id,))
            conn.commit()
            
            if cursor.rowcount == 0:
                return jsonify({"error": f"No {name} found with {key_field}={id}"}), 404
                
            return jsonify({
                "message": f"{name} deleted successfully",
                "deleted_count": cursor.rowcount
            })
            
        except mysql.connector.Error as err:
            return jsonify({"error": f"Database error: {str(err)}"}), 500
        finally:
            cursor.close()
            conn.close()

# -------------------- Create routes for each table --------------------

create_routes("Products", "product_id")
create_routes("DarkStores", "store_id")
create_routes("Users", "user_id")
create_routes("Inventory", "inventory_id")
create_routes("StockMovements", "movement_id")
create_routes("Orders", "order_id")
create_routes("OrderItems", "order_item_id")

# -------------------- Run the App --------------------

if __name__ == "__main__":
    app.run(debug=True)