-- ============================================
-- PHP MVC Data Table - Database Setup
-- ============================================

CREATE DATABASE IF NOT EXISTS table_demo
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE table_demo;

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    mobile     VARCHAR(20)  NOT NULL,
    city       VARCHAR(100) NOT NULL,
    status     ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_email (email),
    INDEX idx_city (city),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data: 35 rows across 8 cities
INSERT INTO users (name, email, mobile, city, status, created_at) VALUES
-- Mumbai (5 users)
('Raj Patel',         'raj.patel@example.com',         '+91-98200-10001', 'Mumbai',    'active',   '2024-01-05 09:30:00'),
('Priya Sharma',      'priya.sharma@example.com',      '+91-98200-10002', 'Mumbai',    'active',   '2024-01-18 14:15:00'),
('Amit Deshmukh',     'amit.deshmukh@example.com',     '+91-98200-10003', 'Mumbai',    'inactive', '2024-02-10 11:00:00'),
('Sneha Kulkarni',    'sneha.kulkarni@example.com',    '+91-98200-10004', 'Mumbai',    'active',   '2024-03-22 16:45:00'),
('Vikram Joshi',      'vikram.joshi@example.com',      '+91-98200-10005', 'Mumbai',    'inactive', '2024-04-08 08:20:00'),

-- Delhi (4 users)
('Anita Verma',       'anita.verma@example.com',       '+91-98100-20001', 'Delhi',     'active',   '2024-01-12 10:00:00'),
('Rohit Gupta',       'rohit.gupta@example.com',       '+91-98100-20002', 'Delhi',     'inactive', '2024-02-25 13:30:00'),
('Kavita Singh',      'kavita.singh@example.com',      '+91-98100-20003', 'Delhi',     'active',   '2024-03-15 09:45:00'),
('Manoj Tiwari',      'manoj.tiwari@example.com',      '+91-98100-20004', 'Delhi',     'active',   '2024-05-01 17:00:00'),

-- Bangalore (5 users)
('Deepa Nair',        'deepa.nair@example.com',        '+91-98450-30001', 'Bangalore', 'active',   '2024-01-20 08:00:00'),
('Suresh Reddy',      'suresh.reddy@example.com',      '+91-98450-30002', 'Bangalore', 'inactive', '2024-02-14 12:30:00'),
('Lakshmi Iyer',      'lakshmi.iyer@example.com',      '+91-98450-30003', 'Bangalore', 'active',   '2024-03-28 15:15:00'),
('Karthik Rao',       'karthik.rao@example.com',       '+91-98450-30004', 'Bangalore', 'active',   '2024-04-16 10:45:00'),
('Meera Hegde',       'meera.hegde@example.com',       '+91-98450-30005', 'Bangalore', 'inactive', '2024-06-02 14:00:00'),

-- Chennai (4 users)
('Arun Kumar',        'arun.kumar@example.com',        '+91-98400-40001', 'Chennai',   'active',   '2024-01-08 11:30:00'),
('Divya Rajan',       'divya.rajan@example.com',       '+91-98400-40002', 'Chennai',   'active',   '2024-02-20 09:00:00'),
('Senthil Murugan',   'senthil.murugan@example.com',   '+91-98400-40003', 'Chennai',   'inactive', '2024-04-05 16:30:00'),
('Pooja Sundar',      'pooja.sundar@example.com',      '+91-98400-40004', 'Chennai',   'active',   '2024-05-18 13:00:00'),

-- Pune (4 users)
('Rahul Deshpande',   'rahul.deshpande@example.com',   '+91-98500-50001', 'Pune',      'active',   '2024-01-25 10:15:00'),
('Swati Bhosale',     'swati.bhosale@example.com',     '+91-98500-50002', 'Pune',      'inactive', '2024-03-10 08:45:00'),
('Nikhil Patil',      'nikhil.patil@example.com',      '+91-98500-50003', 'Pune',      'active',   '2024-04-22 15:30:00'),
('Anjali Kulkarni',   'anjali.kulkarni@example.com',   '+91-98500-50004', 'Pune',      'active',   '2024-06-10 11:00:00'),

-- Hyderabad (4 users)
('Venkat Rao',        'venkat.rao@example.com',        '+91-98490-60001', 'Hyderabad', 'active',   '2024-02-01 09:30:00'),
('Swathi Reddy',      'swathi.reddy@example.com',      '+91-98490-60002', 'Hyderabad', 'inactive', '2024-03-05 14:00:00'),
('Prasad Goud',       'prasad.goud@example.com',       '+91-98490-60003', 'Hyderabad', 'active',   '2024-04-30 12:15:00'),
('Rani Devi',         'rani.devi@example.com',         '+91-98490-60004', 'Hyderabad', 'active',   '2024-05-25 16:45:00'),

-- Kolkata (4 users)
('Sourav Das',        'sourav.das@example.com',        '+91-98300-70001', 'Kolkata',   'active',   '2024-01-30 08:30:00'),
('Rina Chatterjee',   'rina.chatterjee@example.com',   '+91-98300-70002', 'Kolkata',   'active',   '2024-02-28 13:45:00'),
('Debashis Sen',      'debashis.sen@example.com',      '+91-98300-70003', 'Kolkata',   'inactive', '2024-04-12 10:30:00'),
('Moumita Ghosh',     'moumita.ghosh@example.com',     '+91-98300-70004', 'Kolkata',   'active',   '2024-06-05 15:00:00'),

-- Jaipur (5 users)
('Aditya Sharma',     'aditya.sharma@example.com',     '+91-98280-80001', 'Jaipur',    'active',   '2024-01-15 11:00:00'),
('Neha Agarwal',      'neha.agarwal@example.com',      '+91-98280-80002', 'Jaipur',    'inactive', '2024-02-08 09:15:00'),
('Manish Rathore',    'manish.rathore@example.com',    '+91-98280-80003', 'Jaipur',    'active',   '2024-03-20 14:30:00'),
('Sunita Meena',      'sunita.meena@example.com',      '+91-98280-80004', 'Jaipur',    'active',   '2024-05-12 08:00:00'),
('Ravi Shekhawat',    'ravi.shekhawat@example.com',    '+91-98280-80005', 'Jaipur',    'inactive', '2024-06-18 17:30:00');
