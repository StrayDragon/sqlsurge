-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    age INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO users (name, email, age) VALUES 
('张三', 'zhangsan@example.com', 25),
('李四', 'lisi@example.com', 30),
('王五', 'wangwu@example.com', 28),
('赵六', 'zhaoliu@example.com', 35),
('钱七', 'qianqi@example.com', 22),
('孙八', 'sunba@example.com', 29),
('周九', 'zhoujiu@example.com', 31),
('吴十', 'wushi@example.com', 27);

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_name VARCHAR(255),
    quantity INT,
    price DECIMAL(10, 2),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 插入订单测试数据
INSERT INTO orders (user_id, product_name, quantity, price) VALUES 
(1, '笔记本电脑', 1, 5999.00),
(2, '无线鼠标', 2, 199.00),
(3, '机械键盘', 1, 899.00),
(1, '显示器', 1, 2499.00),
(4, '耳机', 1, 599.00),
(2, 'USB线', 3, 29.00),
(5, '移动硬盘', 1, 799.00),
(3, '网络摄像头', 1, 299.00);

-- 创建产品分类表
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 插入分类数据
INSERT INTO categories (name, description) VALUES 
('电脑配件', '各种电脑相关配件'),
('办公用品', '日常办公所需用品'),
('数码产品', '各类数码电子产品');

-- 显示插入的数据
SELECT 'Users table:' as info;
SELECT * FROM users;

SELECT 'Orders table:' as info;
SELECT * FROM orders;

SELECT 'Categories table:' as info;
SELECT * FROM categories;

-- 一些复杂查询示例
SELECT 'User order summary:' as info;
SELECT 
    u.name,
    u.email,
    COUNT(o.id) as order_count,
    SUM(o.price * o.quantity) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email
ORDER BY total_spent DESC;