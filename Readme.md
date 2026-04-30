# Synchire Backend 🚀

## API Endpoints

### Students
GET /api/students  
POST /api/students  
DELETE /api/students/:id  

### Companies
GET /api/companies  
POST /api/companies  
DELETE /api/companies/:id  

### Scheduler
POST /api/generate  

## Tech Stack
- Node.js
- Express
- PostgreSQL (Neon)

## Database Schema
DROP TABLE IF EXISTS interviews CASCADE;
DROP TABLE IF EXISTS interview_requests CASCADE;
DROP TABLE IF EXISTS panels CASCADE;
DROP TABLE IF EXISTS slots CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- STUDENTS
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    skills TEXT[] DEFAULT '{}',
    resume_url TEXT
);

-- COMPANIES
CREATE TABLE companies (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    industry VARCHAR(50),
    interview_priority INT DEFAULT 0,
    required_skills TEXT[] DEFAULT '{}'
);

-- PANELS
CREATE TABLE panels (
    panel_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    company_id INT REFERENCES companies(company_id) ON DELETE CASCADE
);

-- SLOTS
CREATE TABLE slots (
    slot_id SERIAL PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL
);

-- INTERVIEW REQUESTS
CREATE TABLE interview_requests (
    request_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id) ON DELETE CASCADE,
    company_id INT REFERENCES companies(company_id) ON DELETE CASCADE,
    UNIQUE(student_id, company_id)
);

-- INTERVIEWS
CREATE TABLE interviews (
    interview_id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(student_id) ON DELETE CASCADE,
    panel_id INT REFERENCES panels(panel_id) ON DELETE CASCADE,
    slot_id INT REFERENCES slots(slot_id) ON DELETE CASCADE,
    UNIQUE(student_id, slot_id),
    UNIQUE(panel_id, slot_id)
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_students ON students(student_id);
CREATE INDEX idx_panels ON panels(panel_id);
CREATE INDEX idx_slots ON slots(slot_id);
CREATE INDEX idx_requests ON interview_requests(student_id, company_id);


-- =========================
-- SEED STUDENTS
-- =========================
INSERT INTO students (name, email, skills, resume_url) VALUES
('Rahul Verma', 'rahul1@gmail.com', ARRAY['c++', 'dsa'], 'resume1.pdf'),
('Ananya Sharma', 'ananya1@gmail.com', ARRAY['python', 'ml'], 'resume2.pdf'),
('Amit Singh', 'amit1@gmail.com', ARRAY['javascript', 'node'], 'resume3.pdf'),
('Sneha Kapoor', 'sneha@gmail.com', ARRAY['java', 'spring'], 'resume4.pdf'),
('Karan Mehta', 'karan@gmail.com', ARRAY['react', 'frontend'], 'resume5.pdf'),
('Priya Nair', 'priya@gmail.com', ARRAY['sql', 'dbms'], 'resume6.pdf'),
('Arjun Reddy', 'arjun@gmail.com', ARRAY['python', 'django'], 'resume7.pdf'),
('Neha Gupta', 'neha@gmail.com', ARRAY['c', 'os'], 'resume8.pdf'),
('Rohit Sharma', 'rohit@gmail.com', ARRAY['java', 'dsa'], 'resume9.pdf'),
('Isha Patel', 'isha@gmail.com', ARRAY['ai', 'ml'], 'resume10.pdf');


-- =========================
-- SEED COMPANIES
-- =========================
INSERT INTO companies (name, industry, interview_priority, required_skills) VALUES
('Google', 'Tech', 5, ARRAY['dsa', 'c++']),
('Amazon', 'Tech', 4, ARRAY['javascript', 'node']),
('Infosys', 'IT Services', 3, ARRAY['sql', 'dbms']);


-- =========================
-- SEED PANELS (MORE PANELS 🔥)
-- =========================
INSERT INTO panels (name, company_id) VALUES
('Google Panel 1', 1),
('Google Panel 2', 1),
('Google Panel 3', 1),

('Amazon Panel 1', 2),
('Amazon Panel 2', 2),

('Infosys Panel 1', 3),
('Infosys Panel 2', 3);


-- =========================
-- SEED SLOTS (MORE SLOTS 🔥)
-- =========================
INSERT INTO slots (start_time, end_time) VALUES
('2026-04-25 09:00:00', '2026-04-25 10:00:00'),
('2026-04-25 10:00:00', '2026-04-25 11:00:00'),
('2026-04-25 11:00:00', '2026-04-25 12:00:00'),
('2026-04-25 12:00:00', '2026-04-25 13:00:00'),
('2026-04-25 13:00:00', '2026-04-25 14:00:00'),
('2026-04-25 14:00:00', '2026-04-25 15:00:00');


-- =========================
-- SEED INTERVIEW REQUESTS
-- =========================
INSERT INTO interview_requests (student_id, company_id) VALUES
(1,1),
(1,2),
(2,1),
(2,3),
(3,2),
(4,1),
(5,2),
(6,3),
(7,1),
(8,2),
(9,3),
(10,1);