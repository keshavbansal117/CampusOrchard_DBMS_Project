import Database from 'better-sqlite3';

export const db = new Database('campus_orchard.db');

// Initialize schema with improved version
db.exec(`
  CREATE TABLE IF NOT EXISTS Student (
    StudentID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    Phone TEXT,
    Department TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Faculty (
    FacultyID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    Phone TEXT,
    Department TEXT,
    Designation TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Admin (
    AdminID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Admin_Log (
    LogID INTEGER PRIMARY KEY AUTOINCREMENT,
    AdminID INTEGER NOT NULL,
    ActionType TEXT NOT NULL,
    EntityID INTEGER,
    Details TEXT,
    ActionTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (AdminID) REFERENCES Admin(AdminID) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS Society (
    SocietyID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Description TEXT,
    FoundedDate TEXT,
    FacultyPresidentID INTEGER,
    StudentSecretaryID INTEGER,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (FacultyPresidentID) REFERENCES Faculty(FacultyID) ON DELETE SET NULL,
    FOREIGN KEY (StudentSecretaryID) REFERENCES Student(StudentID) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS Society_Member (
    SocietyID INTEGER NOT NULL,
    StudentID INTEGER NOT NULL,
    Role TEXT NOT NULL DEFAULT 'Member',
    JoinedDate TEXT NOT NULL,
    PRIMARY KEY (SocietyID, StudentID),
    FOREIGN KEY (SocietyID) REFERENCES Society(SocietyID) ON DELETE CASCADE,
    FOREIGN KEY (StudentID) REFERENCES Student(StudentID) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Event (
    EventID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    SocietyID INTEGER NOT NULL,
    EventDate TEXT NOT NULL,
    ExpectedAttendees INTEGER,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (SocietyID) REFERENCES Society(SocietyID) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Resource (
    ResourceID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Type TEXT,
    Capacity INTEGER,
    Location TEXT,
    Status TEXT DEFAULT 'Active',
    UpdatedByAdminID INTEGER,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UpdatedByAdminID) REFERENCES Admin(AdminID) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS Equipment (
    EquipmentID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    ResourceID INTEGER,
    Status TEXT DEFAULT 'Working',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ResourceID) REFERENCES Resource(ResourceID) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Booking_Equipment (
    BookingEquipID INTEGER PRIMARY KEY AUTOINCREMENT,
    RequestID INTEGER NOT NULL,
    EquipmentID INTEGER NOT NULL,
    UNIQUE (RequestID, EquipmentID),
    FOREIGN KEY (RequestID) REFERENCES Booking_Request(RequestID) ON DELETE CASCADE,
    FOREIGN KEY (EquipmentID) REFERENCES Equipment(EquipmentID) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Booking_Request (
    RequestID INTEGER PRIMARY KEY AUTOINCREMENT,
    EventID INTEGER NOT NULL,
    ResourceID INTEGER NOT NULL,
    SubmittedByStudentID INTEGER NOT NULL,
    BookingDate TEXT NOT NULL,
    StartTime TEXT NOT NULL,
    EndTime TEXT NOT NULL,
    Status TEXT DEFAULT 'Pending' CHECK (Status IN ('Pending', 'Pending Admin', 'Approved', 'Rejected')),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EventID) REFERENCES Event(EventID) ON DELETE CASCADE,
    FOREIGN KEY (ResourceID) REFERENCES Resource(ResourceID) ON DELETE CASCADE,
    FOREIGN KEY (SubmittedByStudentID) REFERENCES Student(StudentID) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS Approval (
    ApprovalID INTEGER PRIMARY KEY AUTOINCREMENT,
    RequestID INTEGER NOT NULL UNIQUE,
    FacultyID INTEGER NOT NULL,
    AdminID INTEGER,
    Status TEXT CHECK (Status IN ('Faculty Approved', 'Approved', 'Rejected')),
    Comments TEXT,
    ApprovalDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RequestID) REFERENCES Booking_Request(RequestID) ON DELETE CASCADE,
    FOREIGN KEY (FacultyID) REFERENCES Faculty(FacultyID) ON DELETE RESTRICT,
    FOREIGN KEY (AdminID) REFERENCES Admin(AdminID) ON DELETE SET NULL
  );

  -- Views
  CREATE VIEW IF NOT EXISTS vw_Pending_Approvals AS
  SELECT
      br.RequestID, e.Name AS EventName, r.Name AS ResourceName,
      e.EventDate, br.BookingDate, br.StartTime, br.EndTime,
      s.Name AS SocietyName, st.Name AS SubmittedBySecretary, br.Status
  FROM Booking_Request br
  JOIN Event e ON br.EventID = e.EventID
  JOIN Resource r ON br.ResourceID = r.ResourceID
  JOIN Society s ON e.SocietyID = s.SocietyID
  JOIN Student st ON br.SubmittedByStudentID = st.StudentID
  WHERE br.Status IN ('Pending', 'Pending Admin');

  -- Triggers
  CREATE TRIGGER IF NOT EXISTS trg_After_Approval_Insert
  AFTER INSERT ON Approval
  BEGIN
      UPDATE Booking_Request
      SET Status = CASE 
          WHEN NEW.Status = 'Faculty Approved' THEN 'Pending Admin'
          WHEN NEW.Status = 'Approved' THEN 'Approved'
          WHEN NEW.Status = 'Rejected' THEN 'Rejected'
          ELSE Status
      END
      WHERE RequestID = NEW.RequestID;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_After_Approval_Update
  AFTER UPDATE ON Approval
  BEGIN
      UPDATE Booking_Request
      SET Status = CASE 
          WHEN NEW.Status = 'Faculty Approved' THEN 'Pending Admin'
          WHEN NEW.Status = 'Approved' THEN 'Approved'
          WHEN NEW.Status = 'Rejected' THEN 'Rejected'
          ELSE Status
      END
      WHERE RequestID = NEW.RequestID;
  END;

  CREATE TRIGGER IF NOT EXISTS trg_Log_Resource_Update
  AFTER UPDATE OF Status, Location ON Resource
  WHEN NEW.UpdatedByAdminID IS NOT NULL
  BEGIN
      INSERT INTO Admin_Log (AdminID, ActionType, EntityID, Details)
      VALUES (NEW.UpdatedByAdminID, 'UPDATE_RESOURCE', NEW.ResourceID, 'Status: ' || NEW.Status || ' | Location: ' || IFNULL(NEW.Location, 'N/A'));
  END;

  CREATE TRIGGER IF NOT EXISTS trg_Booking_Status_Change
  AFTER UPDATE OF Status ON Booking_Request
  WHEN (NEW.Status IN ('Rejected', 'Approved')) AND OLD.Status != NEW.Status
  BEGIN
      UPDATE Equipment
      SET Status = 'Working'
      WHERE EquipmentID IN (SELECT EquipmentID FROM Booking_Equipment WHERE RequestID = NEW.RequestID)
        AND Status = 'Reserved';
  END;
`);

// Seed data if empty
const studentCount = db.prepare('SELECT COUNT(*) as count FROM Student').get() as { count: number };
if (studentCount.count === 0) {
  // Students
  db.prepare("INSERT INTO Student (Name, Email, Department) VALUES ('Arjun Singh', 'arjun.s@campus.edu', 'Computer Science')").run();
  db.prepare("INSERT INTO Student (Name, Email, Department) VALUES ('Meera Patel', 'meera.p@campus.edu', 'Electronics')").run();
  db.prepare("INSERT INTO Student (Name, Email, Department) VALUES ('Rohan Verma', 'rohan.v@campus.edu', 'Mechanical')").run();
  db.prepare("INSERT INTO Student (Name, Email, Department) VALUES ('Priya Sharma', 'priya.s@campus.edu', 'Civil')").run();
  db.prepare("INSERT INTO Student (Name, Email, Department) VALUES ('Rahul Gupta', 'rahul.g@campus.edu', 'Electrical')").run();
  db.prepare("INSERT INTO Student (Name, Email, Department) VALUES ('Sneha Jain', 'sneha.j@campus.edu', 'Computer Science')").run();

  // Faculty
  db.prepare("INSERT INTO Faculty (Name, Email, Department, Designation) VALUES ('Dr. Anil Kumar', 'anil.k@campus.edu', 'Computer Science', 'Professor')").run();
  db.prepare("INSERT INTO Faculty (Name, Email, Department, Designation) VALUES ('Dr. Sunita Rao', 'sunita.r@campus.edu', 'Electronics', 'Associate Professor')").run();
  db.prepare("INSERT INTO Faculty (Name, Email, Department, Designation) VALUES ('Dr. Rajesh Mishra', 'rajesh.m@campus.edu', 'Mechanical', 'Assistant Professor')").run();
  db.prepare("INSERT INTO Faculty (Name, Email, Department, Designation) VALUES ('Dr. Kavita Singh', 'kavita.s@campus.edu', 'Civil', 'Professor')").run();

  // Admins
  db.prepare("INSERT INTO Admin (Name, Email) VALUES ('Rajiv Sharma', 'rajiv.s@campus.edu')").run();
  db.prepare("INSERT INTO Admin (Name, Email) VALUES ('Deepak Verma', 'deepak.v@campus.edu')").run();

  // Societies
  db.prepare("INSERT INTO Society (Name, Description, FoundedDate, FacultyPresidentID, StudentSecretaryID) VALUES ('Tech Club', 'Technology and coding', '2018-06-01', 1, 1)").run();
  db.prepare("INSERT INTO Society (Name, Description, FoundedDate, FacultyPresidentID, StudentSecretaryID) VALUES ('Cultural Society', 'Arts and events', '2015-08-15', 2, 2)").run();
  db.prepare("INSERT INTO Society (Name, Description, FoundedDate, FacultyPresidentID, StudentSecretaryID) VALUES ('Robotics Club', 'Hardware and bots', '2019-01-10', 3, 3)").run();

  // Society Members
  db.prepare("INSERT INTO Society_Member (SocietyID, StudentID, Role, JoinedDate) VALUES (1, 1, 'Secretary', '2022-07-01')").run();
  db.prepare("INSERT INTO Society_Member (SocietyID, StudentID, Role, JoinedDate) VALUES (1, 6, 'Member', '2023-01-15')").run();
  db.prepare("INSERT INTO Society_Member (SocietyID, StudentID, Role, JoinedDate) VALUES (2, 2, 'Secretary', '2021-08-01')").run();
  db.prepare("INSERT INTO Society_Member (SocietyID, StudentID, Role, JoinedDate) VALUES (3, 3, 'Secretary', '2022-09-01')").run();

  // Events
  db.prepare("INSERT INTO Event (Name, SocietyID, EventDate, ExpectedAttendees) VALUES ('Annual Tech Fest', 1, '2026-11-20', 400)").run();
  db.prepare("INSERT INTO Event (Name, SocietyID, EventDate, ExpectedAttendees) VALUES ('Weekly Workshop', 1, '2026-11-25', 50)").run();
  db.prepare("INSERT INTO Event (Name, SocietyID, EventDate, ExpectedAttendees) VALUES ('Cultural Night', 2, '2026-12-05', 300)").run();
  db.prepare("INSERT INTO Event (Name, SocietyID, EventDate, ExpectedAttendees) VALUES ('Robo Wars', 3, '2026-12-15', 100)").run();

  // Resources
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('Main Auditorium', 'Auditorium', 500, 'Block A', 'Active', 1)").run();
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('LT Hall', 'Seminar Hall', 150, 'Block B', 'Active', 1)").run();
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('Computer Lab 3', 'Lab', 60, 'Block C', 'Active', 1)").run();
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('OAT', 'Auditorium', 800, 'Campus Center', 'Active', 1)").run();
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('LP Hall', 'Seminar Hall', 120, 'Block B', 'Maintenance', 2)").run();
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('Tan Audi', 'Auditorium', 400, 'Block A', 'Active', 1)").run();
  db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES ('B block auditorium', 'Auditorium', 600, 'Block B', 'Active', 1)").run();

  // Equipment
  db.prepare("INSERT INTO Equipment (Name, ResourceID, Status) VALUES ('Projector A', 1, 'Working')").run();
  db.prepare("INSERT INTO Equipment (Name, ResourceID, Status) VALUES ('Microphone Set', 1, 'Working')").run();
  db.prepare("INSERT INTO Equipment (Name, ResourceID, Status) VALUES ('Whiteboard', 2, 'Working')").run();
  db.prepare("INSERT INTO Equipment (Name, ResourceID, Status) VALUES ('PA System', 4, 'Under Repair')").run();
  db.prepare("INSERT INTO Equipment (Name, ResourceID, Status) VALUES ('Projector B', 2, 'Working')").run();

  // Admin Logs
  db.prepare("INSERT INTO Admin_Log (AdminID, ActionType, Details) VALUES (1, 'SYSTEM_INIT', 'Seed data created')").run();
  db.prepare("INSERT INTO Admin_Log (AdminID, ActionType, Details) VALUES (2, 'UPDATE_RESOURCE', 'Set Seminar Hall 2 to Maintenance')").run();

  // Bookings
  db.prepare("INSERT INTO Booking_Request (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status) VALUES (1, 1, 1, '2026-11-20', '09:00', '17:00', 'Pending Admin')").run();
  db.prepare("INSERT INTO Booking_Request (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status) VALUES (2, 2, 1, '2026-11-25', '14:00', '16:00', 'Approved')").run();
  db.prepare("INSERT INTO Booking_Request (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status) VALUES (3, 4, 2, '2026-12-05', '18:00', '22:00', 'Pending')").run();
  db.prepare("INSERT INTO Booking_Request (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status) VALUES (4, 3, 3, '2026-12-15', '10:00', '15:00', 'Pending')").run();

  // Approvals
  db.prepare("INSERT INTO Approval (RequestID, FacultyID, Status, Comments) VALUES (1, 1, 'Faculty Approved', 'Approved for Tech Fest')").run();
  db.prepare("INSERT INTO Approval (RequestID, FacultyID, AdminID, Status, Comments) VALUES (2, 1, 1, 'Approved', 'Approved by both')").run();
}

