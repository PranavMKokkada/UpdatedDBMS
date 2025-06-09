# UpdatedDBMS
## It is a darkstore management project built using mysql
### Below are the mysql codes
---


use quickCommerceDB

---
CREATE TABLE darkstores (
    store_id INT PRIMARY KEY,
    name VARCHAR(100),
    location VARCHAR(100),
    region VARCHAR(50),
    contact_info VARCHAR(100)
);

INSERT INTO darkstores VALUES
(1, 'QuickStore Alpha', 'Indiranagar, Bangalore', 'South', 'info.alpha@quickcommerce.com'),
(2, 'SpeedyMart Beta', 'Koramangala, Bangalore', 'South', 'sales.beta@quickcommerce.com'),
(3, 'FlashShop Gamma', 'HSR Layout, Bangalore', 'South', 'support.gamma@quickcommerce.com'),
(4, 'ZipZone Delta', 'Whitefield, Bangalore', 'East', 'marketing.delta@quickcommerce.com'),
(5, 'RapidRetail Epsilon', 'JP Nagar, Bangalore', 'South', 'hr.epsilon@quickcommerce.com'),
(12345, 'Hari stores', 'Hossur', 'Tamil Nadu', 'help@haristores.com');

---
CREATE TABLE inventory (
    inventory_id INT PRIMARY KEY,
    product_id INT,
    store_id INT,
    quantity_available INT,
    quantity_reserved INT,
    reorder_threshold INT,
    last_updated DATETIME
);

INSERT INTO inventory VALUES
(501, 101, 1, 50, 5, 10, '2025-05-28 09:00:00'),
(502, 102, 2, 100, 2, 20, '2025-05-28 09:15:00'),
(503, 103, 1, 30, 1, 15, '2025-05-28 09:30:00'),
(504, 104, 3, 15, 0, 5, '2025-05-28 09:45:00'),
(505, 105, 2, 75, 3, 25, '2025-05-28 10:00:00');

---
CREATE TABLE orderitems (
    order_item_id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    unit_price DECIMAL(10,2),
    discount DECIMAL(4,2)
);

INSERT INTO orderitems VALUES
(401, 301, 101, 2, 65.00, 0.00),
(402, 301, 102, 1, 40.00, 0.05),
(403, 302, 103, 1, 70.00, 0.10),
(404, 303, 104, 1, 120000.00, 0.00),
(405, 303, 105, 2, 750.00, 0.02);

---
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    store_id INT,
    order_timestamp DATETIME,
    status VARCHAR(20),
    delivery_slot VARCHAR(20)
);

INSERT INTO orders VALUES
(301, 201, 1, '2025-05-28 10:00:00', 'delivered', '10:00-12:00'),
(302, 203, 2, '2025-05-28 10:15:00', 'processing', '14:00-16:00'),
(303, 205, 1, '2025-05-28 10:30:00', 'pending', '18:00-20:00'),
(304, 201, 3, '2025-05-28 11:00:00', 'delivered', '12:00-14:00'),
(305, 203, 2, '2025-05-28 11:15:00', 'shipped', '16:00-18:00');

---

CREATE TABLE products (
    product_id INT PRIMARY KEY,
    name VARCHAR(100),
    brand VARCHAR(50),
    barcode VARCHAR(20),
    is_perishable BOOLEAN,
    unit_of_measure VARCHAR(20)
);

INSERT INTO products VALUES
(101, 'Milk (1L)', 'Amul', '8901234567890', 1, 'Liter'),
(102, 'Bread (400g)', 'Britannia', '8909876543210', 1, 'Gram'),
(103, 'Eggs (12 count)', 'Suguna', '8905555121212', 1, 'Count'),
(104, 'Laptop', 'Dell', '0012345678901', 0, 'Unit'),
(105, 'T-Shirt (Size M)', 'Nike', '0098765432109', 0, 'Unit'),
(999, 'Test Product', 'Test Brand', 'TEST123', 0, 'Unit');


---


CREATE TABLE stockmovements (
    movement_id INT PRIMARY KEY,
    product_id INT,
    store_id INT,
    type VARCHAR(20),
    quantity INT,
    timestamp DATETIME,
    reference VARCHAR(50)
);

INSERT INTO stockmovements VALUES
(601, 101, 1, 'inbound', 100, '2025-05-27 14:00:00', 'PO-001'),
(602, 102, 2, 'outbound', 5, '2025-05-28 10:05:00', 'ORD-301'),
(603, 103, 1, 'adjustment', -2, '2025-05-28 10:10:00', 'Damaged'),
(604, 104, 3, 'inbound', 20, '2025-05-27 16:00:00', 'PO-002'),
(605, 105, 2, 'outbound', 2, '2025-05-28 11:20:00', 'ORD-303');


---

CREATE TABLE users (
    user_id INT PRIMARY KEY,
    name VARCHAR(100),
    role VARCHAR(50),
    store_id INT,
    login_credentials VARCHAR(50)
);

INSERT INTO users VALUES
(201, 'Alice Smith', 'customer', NULL, 'alice123'),
(202, 'Bob Johnson', 'staff', 1, 'bob456'),
(203, 'Charlie Brown', 'customer', NULL, 'charlie789'),
(204, 'Diana Lee', 'staff', 2, 'diana012'),
(205, 'Eve Williams', 'customer', NULL, 'eve345'),
(12345, 'Pmk', 'student', 12345, 'help');


---
