from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from dotenv import load_dotenv
import os
import re

load_dotenv()  # Load environment variables from .env

app = Flask(__name__)
CORS(app)

# MySQL connection
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DB = os.getenv("MYSQL_DB", "quickCommerceDB")

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

@app.route('/')
def index():
    return jsonify({"message": "Welcome to QuickCommerce API!"})

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
            cursor.execute(f"SELECT * FROM `{table_name}`")
            items = cursor.fetchall()
            # Convert datetime objects to string for JSON serialization
            for item in items:
                for key, value in item.items():
                    if hasattr(value, 'isoformat'):
                        item[key] = value.isoformat()
            all_data[table_name] = items
        except mysql.connector.Error as err:
            print(f"Error fetching {table_name}: {err}")
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
        return jsonify({"error": "Missing required fields: table_name, key, attribute_list"}), 400

    # Validate table name
    allowed_tables = ["Products", "DarkStores", "Users", "Inventory", 
                     "StockMovements", "Orders", "OrderItems"]
    if table_name not in allowed_tables:
        return jsonify({"error": f"Invalid table name: {table_name}"}), 400

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
    set_clause = ", ".join([f"`{k}` = %s" for k in attribute_list.keys()])
    values = list(attribute_list.values())
    values.append(key)  # For WHERE clause

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor()
    query = f"UPDATE `{table_name}` SET {set_clause} WHERE `{key_field}` = %s"
    
    try:
        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"error": f"No record found with {key_field} = {key}"}), 404
            
        return jsonify({
            "message": f"{table_name} updated successfully",
            "modified_count": cursor.rowcount
        })
    except mysql.connector.Error as err:
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        conn.close()

# -------------------- Utility --------------------
def create_routes(name, key_field):
    # Add document
    @app.route(f'/add-{name}', methods=['POST'], endpoint=f'add_{name}')
    def add():
        data = request.get_json()
        if not data.get(key_field):
            return jsonify({"error": f"{key_field} is required"}), 400
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            columns = ', '.join([f"`{k}`" for k in data.keys()])
            placeholders = ', '.join(['%s'] * len(data))
            query = f"INSERT INTO `{name}` ({columns}) VALUES ({placeholders})"
            try:
                cursor.execute(query, list(data.values()))
                conn.commit()
                cursor.close()
                conn.close()
                return jsonify({"message": f"{name} added successfully!"}), 201
            except mysql.connector.Error as err:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Error adding {name}: {err}"}), 500
        return jsonify({"error": "Failed to connect to the database"}), 500

    # Get all documents
    @app.route(f'/get-{name}', methods=['GET'], endpoint=f'get_all_{name}')
    def get_all():
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor(dictionary=True)
            query = f"SELECT * FROM `{name}`"
            try:
                cursor.execute(query)
                items = cursor.fetchall()
                cursor.close()
                conn.close()
                return jsonify(items)
            except mysql.connector.Error as err:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Error fetching {name}: {err}"}), 500
        return jsonify({"error": "Failed to connect to the database"}), 500

    # Update by key
    @app.route(f'/update-{name}/<id>', methods=['PUT'], endpoint=f'update_{name}')
    def update(id):
        data = request.get_json()
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            set_clauses = ', '.join([f"`{key}` = %s" for key in data.keys()])
            query = f"UPDATE `{name}` SET {set_clauses} WHERE `{key_field}` = %s"
            values = list(data.values()) + [id]
            try:
                cursor.execute(query, values)
                conn.commit()
                cursor.close()
                conn.close()
                if cursor.rowcount == 0:
                    return jsonify({"error": f"{name} not found"}), 404
                return jsonify({"message": f"{name} updated successfully!"})
            except mysql.connector.Error as err:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Error updating {name}: {err}"}), 500
        return jsonify({"error": "Failed to connect to the database"}), 500

    # Delete by key
    @app.route(f'/delete-{name}/<id>', methods=['DELETE'], endpoint=f'delete_{name}')
    def delete(id):
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            query = f"DELETE FROM `{name}` WHERE `{key_field}` = %s"
            try:
                cursor.execute(query, (id,))
                conn.commit()
                cursor.close()
                conn.close()
                if cursor.rowcount == 0:
                    return jsonify({"error": f"{name} not found"}), 404
                return jsonify({"message": f"{name} deleted successfully!"})
            except mysql.connector.Error as err:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Error deleting {name}: {err}"}), 500
        return jsonify({"error": "Failed to connect to the database"}), 500

# -------------------- Routes for Each Table --------------------

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