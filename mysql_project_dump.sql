-- =================================================================================
-- CAMPUS ORCHARD - MySQL Database Dump (IMPROVED VERSION)
-- Improvements applied:
--   1.  INT AUTO_INCREMENT IDs (clean, no redundant Code columns)
--   2.  BookingDate added directly to Booking_Request
--   3.  Society_Member table added
--   4.  Equipment booking/availability tracking added
--   5.  StartTime < EndTime CHECK constraint enforced
--   6.  Approval.FacultyID made NOT NULL
--   7.  Admin soft-delete (is_active flag) to preserve audit trail
--   8.  Missing indexes on all FK / join columns
--   9.  sp_SubmitBooking validates EventID exists
--   10. fn_CheckAvailability includes Pending/Pending Admin (race condition fix)
--   11. Trigger added for Booking cancellation (free resource)
--   12. vw_Admin_Logs_Recent ORDER BY removed from view definition
--   13. vw_Approved_Schedule view added
--   14. Equipment.Status CHECK constraint added
--   15. UpdatedAt timestamps added to core tables
--   16. Society description & founding date added
-- ---- Round 3 Fixes ---------------------------------------------------------------
--   17. fn_CheckAvailability now uses BookingDate (not EventDate) — consistency fix
--   18. UNIQUE constraint on Approval.RequestID — prevents duplicate approvals
--   19. Equipment release trigger fixed — removed wrong Status condition
--   20. Capacity validation added in sp_SubmitBooking
--   21. Resource Status validated before booking (blocks Maintenance/Inactive)
--   22. Admin approval blocked if Faculty has not approved first (workflow integrity)
--   23. Event.SocietyID made NOT NULL (events must belong to a society)
--   24. Index added on Booking_Equipment.RequestID
--   25. Admin_Log normalized: ActionType + EntityID columns added
--   26. Equipment overlap check added in sp_SubmitBooking
-- ---- Round 5 Fixes ---------------------------------------------------------------
--   27. Equipment.Status includes 'Reserved' — set explicitly via sp_AddBookingEquipment
--   28. Equipment overlap logic fixed — checks per specific EquipmentID, not all on resource
--   29. Admin cannot overwrite a final decision — sp_VerifyBooking blocks non-Pending Admin state
--   30. trg_Booking_Status_Change — resets Reserved → Working on Approved/Rejected
-- ---- Round 6 Fix ----------------------------------------------------------------
--   31. Option A implemented — only the Student Secretary of a society can submit
--       a booking request; SubmittedByStudentID added to Booking_Request with
--       FK → Student (ON DELETE RESTRICT); secretary validated in sp_SubmitBooking
--   32. Queries section removed (schema-only file)
-- =================================================================================


-- =================================================================================
-- SECTION 1: CORE ENTITY TABLES
-- =================================================================================

CREATE TABLE Student (
    StudentID   INT AUTO_INCREMENT PRIMARY KEY,
    Name        VARCHAR(100) NOT NULL,
    Email       VARCHAR(100) UNIQUE NOT NULL,
    Phone       VARCHAR(15),
    Department  VARCHAR(50),
    CreatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE Faculty (
    FacultyID   INT AUTO_INCREMENT PRIMARY KEY,
    Name        VARCHAR(100) NOT NULL,
    Email       VARCHAR(100) UNIQUE NOT NULL,
    Phone       VARCHAR(15),
    Department  VARCHAR(50),
    Designation VARCHAR(50),
    CreatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Admins use soft-delete (is_active) to preserve audit trail integrity
CREATE TABLE Admin (
    AdminID   INT AUTO_INCREMENT PRIMARY KEY,
    Name      VARCHAR(100) NOT NULL,
    Email     VARCHAR(100) UNIQUE NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,     -- 0 = soft-deleted, logs still intact
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Admin Logs: ON DELETE RESTRICT prevents losing accountability
-- (Admins must be soft-deleted, never hard-deleted)
-- Normalized: ActionType is a queryable category; Details holds extra context; EntityID links to affected row
CREATE TABLE Admin_Log (
    LogID      INT AUTO_INCREMENT PRIMARY KEY,
    AdminID    INT NOT NULL,
    ActionType VARCHAR(50) NOT NULL,                 -- e.g. 'APPROVE', 'REJECT', 'UPDATE_RESOURCE', 'DEACTIVATE_ADMIN'
    EntityID   INT,                                  -- ID of the affected row (ApprovalID, ResourceID, etc.)
    Details    VARCHAR(255),                         -- Optional extra context / notes
    ActionTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (AdminID) REFERENCES Admin(AdminID) ON DELETE RESTRICT
);


-- =================================================================================
-- SECTION 2: SOCIETY & MEMBERSHIP
-- =================================================================================

CREATE TABLE Society (
    SocietyID          INT AUTO_INCREMENT PRIMARY KEY,
    Name               VARCHAR(100) NOT NULL,
    Description        TEXT,
    FoundedDate        DATE,
    FacultyPresidentID INT,
    StudentSecretaryID INT,
    CreatedAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (FacultyPresidentID) REFERENCES Faculty(FacultyID) ON DELETE SET NULL,
    FOREIGN KEY (StudentSecretaryID) REFERENCES Student(StudentID) ON DELETE SET NULL
);

-- Tracks which students belong to which society and in what role
CREATE TABLE Society_Member (
    SocietyID  INT NOT NULL,
    StudentID  INT NOT NULL,
    Role       VARCHAR(50) NOT NULL DEFAULT 'Member',   -- e.g. Member, Coordinator, Treasurer
    JoinedDate DATE NOT NULL,
    PRIMARY KEY (SocietyID, StudentID),
    FOREIGN KEY (SocietyID) REFERENCES Society(SocietyID) ON DELETE CASCADE,
    FOREIGN KEY (StudentID) REFERENCES Student(StudentID) ON DELETE CASCADE
);


-- =================================================================================
-- SECTION 3: EVENT
-- =================================================================================

CREATE TABLE Event (
    EventID           INT AUTO_INCREMENT PRIMARY KEY,
    Name              VARCHAR(150) NOT NULL,
    SocietyID         INT NOT NULL,                      -- Every event must belong to a society
    EventDate         DATE NOT NULL,
    ExpectedAttendees INT CHECK (ExpectedAttendees > 0),
    CreatedAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (SocietyID) REFERENCES Society(SocietyID) ON DELETE CASCADE
);


-- =================================================================================
-- SECTION 4: RESOURCE & EQUIPMENT
-- =================================================================================

CREATE TABLE Resource (
    ResourceID        INT AUTO_INCREMENT PRIMARY KEY,
    Name              VARCHAR(100) NOT NULL,
    Type              VARCHAR(50),                  -- e.g. Auditorium, Lab, Seminar Hall
    Capacity          INT CHECK (Capacity > 0),
    Location          VARCHAR(100),
    Status            VARCHAR(20) DEFAULT 'Active'
                          CHECK (Status IN ('Active', 'Maintenance', 'Inactive')),
    UpdatedByAdminID  INT,
    CreatedAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (UpdatedByAdminID) REFERENCES Admin(AdminID) ON DELETE SET NULL
);

-- Equipment now tracks individual check-out/return per booking
CREATE TABLE Equipment (
    EquipmentID INT AUTO_INCREMENT PRIMARY KEY,
    Name        VARCHAR(100) NOT NULL,
    ResourceID  INT,
    Status      VARCHAR(20) DEFAULT 'Working'
                    CHECK (Status IN ('Working', 'Reserved', 'Damaged', 'Under Repair')),
    CreatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ResourceID) REFERENCES Resource(ResourceID) ON DELETE CASCADE
);

-- Links specific equipment items to a booking request
CREATE TABLE Booking_Equipment (
    BookingEquipID INT AUTO_INCREMENT PRIMARY KEY,
    RequestID      INT NOT NULL,
    EquipmentID    INT NOT NULL,
    UNIQUE KEY uq_booking_equipment (RequestID, EquipmentID),
    FOREIGN KEY (RequestID)   REFERENCES Booking_Request(RequestID) ON DELETE CASCADE,
    FOREIGN KEY (EquipmentID) REFERENCES Equipment(EquipmentID)     ON DELETE CASCADE
);


-- =================================================================================
-- SECTION 5: BOOKING REQUEST
-- =================================================================================

CREATE TABLE Booking_Request (
    RequestID           INT AUTO_INCREMENT PRIMARY KEY,
    EventID             INT NOT NULL,
    ResourceID          INT NOT NULL,
    SubmittedByStudentID INT NOT NULL,               -- Must be the society's designated secretary
    BookingDate         DATE NOT NULL,
    StartTime           TIME NOT NULL,
    EndTime             TIME NOT NULL,
    Status              VARCHAR(20) DEFAULT 'Pending'
                            CHECK (Status IN ('Pending', 'Pending Admin', 'Approved', 'Rejected')),
    CreatedAt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_time_order CHECK (StartTime < EndTime),

    FOREIGN KEY (EventID)              REFERENCES Event(EventID)       ON DELETE CASCADE,
    FOREIGN KEY (ResourceID)           REFERENCES Resource(ResourceID) ON DELETE CASCADE,
    FOREIGN KEY (SubmittedByStudentID) REFERENCES Student(StudentID)   ON DELETE RESTRICT
);


-- =================================================================================
-- SECTION 6: APPROVAL (Two-step: Faculty → Admin)
-- =================================================================================

CREATE TABLE Approval (
    ApprovalID   INT AUTO_INCREMENT PRIMARY KEY,
    RequestID    INT NOT NULL UNIQUE,                    -- One approval record per booking only
    FacultyID    INT NOT NULL,
    AdminID      INT,                                -- Filled in at Step 2
    Status       VARCHAR(20)
                     CHECK (Status IN ('Faculty Approved', 'Approved', 'Rejected')),
    Comments     TEXT,
    ApprovalDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RequestID) REFERENCES Booking_Request(RequestID) ON DELETE CASCADE,
    FOREIGN KEY (FacultyID) REFERENCES Faculty(FacultyID)         ON DELETE RESTRICT,
    FOREIGN KEY (AdminID)   REFERENCES Admin(AdminID)             ON DELETE SET NULL
);


-- =================================================================================
-- SECTION 7: INDEXES
-- =================================================================================

-- Booking_Request
CREATE INDEX idx_booking_status   ON Booking_Request(Status);
CREATE INDEX idx_booking_event    ON Booking_Request(EventID);
CREATE INDEX idx_booking_resource ON Booking_Request(ResourceID);
CREATE INDEX idx_booking_date     ON Booking_Request(BookingDate);
CREATE INDEX idx_booking_student  ON Booking_Request(SubmittedByStudentID);

-- Event
CREATE INDEX idx_event_date    ON Event(EventDate);
CREATE INDEX idx_event_society ON Event(SocietyID);

-- Admin_Log
CREATE INDEX idx_admin_log_time  ON Admin_Log(ActionTime);
CREATE INDEX idx_admin_log_admin ON Admin_Log(AdminID);

-- Approval
CREATE INDEX idx_approval_request ON Approval(RequestID);
CREATE INDEX idx_approval_faculty ON Approval(FacultyID);
CREATE INDEX idx_approval_admin   ON Approval(AdminID);

-- Equipment
CREATE INDEX idx_equipment_resource    ON Equipment(ResourceID);

-- Booking_Equipment
CREATE INDEX idx_bookequip_request     ON Booking_Equipment(RequestID);

-- Society_Member
CREATE INDEX idx_member_student ON Society_Member(StudentID);


-- =================================================================================
-- SECTION 8: VIEWS
-- =================================================================================

-- Pending approvals (both Faculty-pending and Admin-pending)
CREATE VIEW vw_Pending_Approvals AS
SELECT
    br.RequestID,
    e.Name         AS EventName,
    r.Name         AS ResourceName,
    e.EventDate,
    br.BookingDate,
    br.StartTime,
    br.EndTime,
    s.Name         AS SocietyName,
    st.Name        AS SubmittedBySecretary,
    br.Status
FROM Booking_Request br
JOIN Event    e  ON br.EventID             = e.EventID
JOIN Resource r  ON br.ResourceID          = r.ResourceID
JOIN Society  s  ON e.SocietyID            = s.SocietyID
JOIN Student  st ON br.SubmittedByStudentID = st.StudentID
WHERE br.Status IN ('Pending', 'Pending Admin');


-- Recent admin logs (ORDER BY at query time, not in view)
CREATE VIEW vw_Admin_Logs AS
SELECT
    l.LogID,
    a.Name       AS AdminName,
    l.ActionType,
    l.EntityID,
    l.Details,
    l.ActionTime
FROM Admin_Log l
JOIN Admin a ON l.AdminID = a.AdminID;
-- Usage: SELECT * FROM vw_Admin_Logs ORDER BY ActionTime DESC LIMIT 100;


-- Approved bookings schedule
CREATE VIEW vw_Approved_Schedule AS
SELECT
    br.RequestID,
    e.Name         AS EventName,
    r.Name         AS ResourceName,
    r.Type         AS ResourceType,
    r.Location,
    e.EventDate,
    br.BookingDate,
    br.StartTime,
    br.EndTime,
    s.Name         AS SocietyName,
    st.Name        AS SubmittedBySecretary
FROM Booking_Request br
JOIN Event    e  ON br.EventID             = e.EventID
JOIN Resource r  ON br.ResourceID          = r.ResourceID
JOIN Society  s  ON e.SocietyID            = s.SocietyID
JOIN Student  st ON br.SubmittedByStudentID = st.StudentID
WHERE br.Status = 'Approved';


-- Society membership overview
CREATE VIEW vw_Society_Members AS
SELECT
    s.Name     AS SocietyName,
    st.Name    AS StudentName,
    st.Email,
    st.Department,
    sm.Role,
    sm.JoinedDate
FROM Society_Member sm
JOIN Society s  ON sm.SocietyID = s.SocietyID
JOIN Student st ON sm.StudentID = st.StudentID;


-- Change Delimiter for PL/SQL constructs
DELIMITER //


-- =================================================================================
-- SECTION 9: FUNCTIONS
-- =================================================================================

-- fn_CheckAvailability
-- FIX 17: Uses br.BookingDate directly (not EventDate via JOIN) — consistency fix.
-- FIX 10: Blocks on Pending + Pending Admin + Approved to prevent race conditions.
CREATE FUNCTION fn_CheckAvailability(
    p_ResourceID INT,
    p_Date       DATE,
    p_StartTime  TIME,
    p_EndTime    TIME
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE conflict_count INT;

    SELECT COUNT(*) INTO conflict_count
    FROM Booking_Request br
    WHERE br.ResourceID  = p_ResourceID
      AND br.BookingDate = p_Date                              -- uses BookingDate directly
      AND br.Status IN ('Pending', 'Pending Admin', 'Approved')
      AND (p_StartTime < br.EndTime AND p_EndTime > br.StartTime);

    RETURN IF(conflict_count > 0, FALSE, TRUE);
END //


-- =================================================================================
-- SECTION 10: STORED PROCEDURES & TRANSACTIONS
-- =================================================================================

-- sp_SubmitBooking
-- OPTION A: Only the designated Student Secretary of the society can submit a booking.
-- Validation chain:
--   1. StartTime < EndTime sanity check
--   2. Resource must be Active
--   3. Event must exist
--   4. Submitting student must be the secretary of the event's society
--   5. ExpectedAttendees must not exceed Resource.Capacity
--   6. No time conflict on the resource (fn_CheckAvailability)
CREATE PROCEDURE sp_SubmitBooking(
    IN p_EventID             INT,
    IN p_ResourceID          INT,
    IN p_SubmittedByStudentID INT,
    IN p_StartTime           TIME,
    IN p_EndTime             TIME
)
BEGIN
    DECLARE v_BookingDate      DATE;
    DECLARE v_IsAvailable      BOOLEAN;
    DECLARE v_ResourceStatus   VARCHAR(20);
    DECLARE v_ResourceCap      INT;
    DECLARE v_Attendees        INT;
    DECLARE v_SocietyID        INT;
    DECLARE v_SecretaryID      INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transaction rolled back.' AS Message;
    END;

    -- 1. Time sanity check
    IF p_StartTime >= p_EndTime THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'StartTime must be before EndTime.';
    END IF;

    START TRANSACTION;

    -- 2. Lock and validate resource
    SELECT Status, Capacity
    INTO   v_ResourceStatus, v_ResourceCap
    FROM   Resource
    WHERE  ResourceID = p_ResourceID
    FOR UPDATE;

    IF v_ResourceStatus != 'Active' THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Resource is not available (Maintenance or Inactive).';
    END IF;

    -- 3. Validate Event and fetch society + booking date + attendees
    SELECT e.EventDate, e.ExpectedAttendees, e.SocietyID
    INTO   v_BookingDate, v_Attendees, v_SocietyID
    FROM   Event e
    WHERE  e.EventID = p_EventID;

    IF v_BookingDate IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Event not found.';
    END IF;

    -- 4. Secretary validation — submitting student must be the society's secretary
    SELECT StudentSecretaryID
    INTO   v_SecretaryID
    FROM   Society
    WHERE  SocietyID = v_SocietyID;

    IF v_SecretaryID != p_SubmittedByStudentID THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only the Student Secretary of the society can submit a booking request.';
    END IF;

    -- 5. Capacity check
    IF v_Attendees > v_ResourceCap THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ExpectedAttendees exceeds Resource capacity.';
    END IF;

    -- 6. Availability check
    SET v_IsAvailable = fn_CheckAvailability(p_ResourceID, v_BookingDate, p_StartTime, p_EndTime);

    IF NOT v_IsAvailable THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Resource is already booked for the requested time slot.';
    END IF;

    INSERT INTO Booking_Request
        (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status)
    VALUES
        (p_EventID, p_ResourceID, p_SubmittedByStudentID, v_BookingDate, p_StartTime, p_EndTime, 'Pending');

    COMMIT;
    SELECT CONCAT('Booking submitted successfully by Secretary ID ', p_SubmittedByStudentID,
                  '. Use sp_AddBookingEquipment to reserve equipment.') AS Message;
END //


-- sp_AddBookingEquipment
-- Reserves a specific equipment item for a booking.
-- FIX 2: Overlap check is now per EquipmentID (not all equipment on resource).
-- FIX 1: Sets Equipment.Status = 'Reserved' explicitly when linked to a booking.
CREATE PROCEDURE sp_AddBookingEquipment(
    IN p_RequestID   INT,
    IN p_EquipmentID INT
)
BEGIN
    DECLARE v_BookingDate  DATE;
    DECLARE v_StartTime    TIME;
    DECLARE v_EndTime      TIME;
    DECLARE v_EquipStatus  VARCHAR(20);
    DECLARE v_Conflict     INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transaction rolled back.' AS Message;
    END;

    START TRANSACTION;

    -- Fetch booking window
    SELECT BookingDate, StartTime, EndTime
    INTO   v_BookingDate, v_StartTime, v_EndTime
    FROM   Booking_Request
    WHERE  RequestID = p_RequestID;

    IF v_BookingDate IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking request not found.';
    END IF;

    -- Check equipment current status — must be Working to reserve
    SELECT Status INTO v_EquipStatus
    FROM Equipment
    WHERE EquipmentID = p_EquipmentID
    FOR UPDATE;

    IF v_EquipStatus != 'Working' THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Equipment is not available (Reserved, Damaged, or Under Repair).';
    END IF;

    -- FIX 2: Check overlap for THIS specific equipment only
    SELECT COUNT(*) INTO v_Conflict
    FROM Booking_Equipment be
    JOIN Booking_Request   br ON be.RequestID = br.RequestID
    WHERE be.EquipmentID  = p_EquipmentID
      AND br.BookingDate  = v_BookingDate
      AND br.Status IN ('Pending', 'Pending Admin', 'Approved')
      AND (v_StartTime < br.EndTime AND v_EndTime > br.StartTime);

    IF v_Conflict > 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This equipment is already booked for the requested time slot.';
    END IF;

    -- Link equipment to booking
    INSERT INTO Booking_Equipment (RequestID, EquipmentID)
    VALUES (p_RequestID, p_EquipmentID);

    -- FIX 1: Mark equipment as Reserved explicitly
    UPDATE Equipment
    SET Status = 'Reserved'
    WHERE EquipmentID = p_EquipmentID;

    COMMIT;
    SELECT 'Equipment reserved successfully.' AS Message;
END //


-- sp_FacultyApprove: Step 1 — Faculty approves or rejects
CREATE PROCEDURE sp_FacultyApprove(
    IN p_RequestID    INT,
    IN p_FacultyID    INT,
    IN p_Decision     VARCHAR(20),   -- 'Faculty Approved' or 'Rejected'
    IN p_Comments     TEXT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transaction rolled back.' AS Message;
    END;

    IF p_Decision NOT IN ('Faculty Approved', 'Rejected') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid decision. Use Faculty Approved or Rejected.';
    END IF;

    START TRANSACTION;

    INSERT INTO Approval (RequestID, FacultyID, Status, Comments)
    VALUES (p_RequestID, p_FacultyID, p_Decision, p_Comments);

    -- Trigger trg_After_Approval_Merge will sync Booking_Request.Status automatically
    COMMIT;
    SELECT CONCAT('Faculty decision recorded: ', p_Decision) AS Message;
END //


-- sp_VerifyBooking: Step 2 — Admin final verification
-- FIX 22: Admin approval is blocked if Booking_Request is not in 'Pending Admin'
--         status (i.e. faculty must have approved first).
CREATE PROCEDURE sp_VerifyBooking(
    IN p_ApprovalID INT,
    IN p_AdminID    INT,
    IN p_Status     VARCHAR(20),     -- 'Approved' or 'Rejected'
    IN p_Comments   TEXT
)
BEGIN
    DECLARE v_RequestID    INT;
    DECLARE v_BookingStatus VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transaction rolled back.' AS Message;
    END;

    IF p_Status NOT IN ('Approved', 'Rejected') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid status. Use Approved or Rejected.';
    END IF;

    START TRANSACTION;

    -- Fetch the RequestID linked to this approval
    SELECT RequestID INTO v_RequestID
    FROM Approval
    WHERE ApprovalID = p_ApprovalID;

    IF v_RequestID IS NULL THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Approval record not found.';
    END IF;

    -- FIX 22: Ensure booking is in 'Pending Admin' state (faculty approved first)
    -- FIX 3:  Block if approval already has a final decision (Approved or Rejected)
    SELECT Status INTO v_BookingStatus
    FROM Booking_Request
    WHERE RequestID = v_RequestID;

    IF v_BookingStatus != 'Pending Admin' THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot verify: booking must be in Pending Admin state (faculty must approve first, and decision must not already be final).';
    END IF;

    UPDATE Approval
    SET Status   = p_Status,
        AdminID  = p_AdminID,
        Comments = IFNULL(p_Comments, Comments)
    WHERE ApprovalID = p_ApprovalID;

    INSERT INTO Admin_Log (AdminID, ActionType, EntityID, Details)
    VALUES (p_AdminID, 'APPROVE', p_ApprovalID,
            CONCAT('Status set to: ', p_Status));

    -- Trigger trg_After_Approval_Update syncs Booking_Request.Status automatically
    COMMIT;
    SELECT CONCAT('Admin verification recorded: ', p_Status) AS Message;
END //


-- sp_UpdateResource: Admin updates a resource and auto-logs via trigger
CREATE PROCEDURE sp_UpdateResource(
    IN p_ResourceID INT,
    IN p_AdminID    INT,
    IN p_Status     VARCHAR(20),
    IN p_Location   VARCHAR(100)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transaction rolled back.' AS Message;
    END;

    START TRANSACTION;

    UPDATE Resource
    SET Status           = IFNULL(p_Status,   Status),
        Location         = IFNULL(p_Location, Location),
        UpdatedByAdminID = p_AdminID
    WHERE ResourceID = p_ResourceID;

    -- trg_Log_Resource_Update fires automatically after this UPDATE
    COMMIT;
    SELECT 'Resource updated successfully.' AS Message;
END //


-- sp_SoftDeleteAdmin: Deactivates an admin without deleting log records
CREATE PROCEDURE sp_SoftDeleteAdmin(
    IN p_AdminID      INT,
    IN p_RequestorID  INT    -- Admin performing the action (for audit)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Error: Transaction rolled back.' AS Message;
    END;

    START TRANSACTION;

    UPDATE Admin SET is_active = 0 WHERE AdminID = p_AdminID;

    INSERT INTO Admin_Log (AdminID, ActionType, EntityID, Details)
    VALUES (p_RequestorID, 'DEACTIVATE_ADMIN', p_AdminID, 'Admin account soft-deleted');

    COMMIT;
    SELECT 'Admin soft-deleted successfully.' AS Message;
END //


-- =================================================================================
-- SECTION 11: TRIGGERS
-- =================================================================================

-- trg_After_Approval_Merge
-- Syncs Booking_Request.Status when Approval row is inserted or updated.
-- Covers both Faculty (Step 1) and Admin (Step 2) decisions.
CREATE TRIGGER trg_After_Approval_Insert
AFTER INSERT ON Approval
FOR EACH ROW
BEGIN
    DECLARE new_req_status VARCHAR(20);

    IF NEW.Status = 'Faculty Approved' THEN
        SET new_req_status = 'Pending Admin';
    ELSEIF NEW.Status = 'Approved' THEN
        SET new_req_status = 'Approved';
    ELSE
        SET new_req_status = 'Rejected';
    END IF;

    UPDATE Booking_Request
    SET Status = new_req_status
    WHERE RequestID = NEW.RequestID;
END //

CREATE TRIGGER trg_After_Approval_Update
AFTER UPDATE ON Approval
FOR EACH ROW
BEGIN
    DECLARE new_req_status VARCHAR(20);

    IF NEW.Status = 'Faculty Approved' THEN
        SET new_req_status = 'Pending Admin';
    ELSEIF NEW.Status = 'Approved' THEN
        SET new_req_status = 'Approved';
    ELSE
        SET new_req_status = 'Rejected';
    END IF;

    UPDATE Booking_Request
    SET Status = new_req_status
    WHERE RequestID = NEW.RequestID;
END //


-- trg_Log_Resource_Update
-- Auto-logs any resource status/location change via Admin.
CREATE TRIGGER trg_Log_Resource_Update
AFTER UPDATE ON Resource
FOR EACH ROW
BEGIN
    IF NEW.UpdatedByAdminID IS NOT NULL THEN
        INSERT INTO Admin_Log (AdminID, ActionType, EntityID, Details)
        VALUES (NEW.UpdatedByAdminID,
                'UPDATE_RESOURCE',
                NEW.ResourceID,
                CONCAT('Status: ', NEW.Status, ' | Location: ', IFNULL(NEW.Location, 'N/A')));
    END IF;
END //


-- trg_Booking_Status_Change
-- FIX 19: Equipment is released on rejection regardless of its current Status.
-- FIX 1:  Equipment marked 'Reserved' is reset to 'Working' when booking is
--         Rejected OR Approved (approved = event happened, equipment is free again).
--         Damaged/Under Repair items are never touched by this trigger.
CREATE TRIGGER trg_Booking_Status_Change
AFTER UPDATE ON Booking_Request
FOR EACH ROW
BEGIN
    -- Release equipment back to Working when booking reaches a terminal state
    IF (NEW.Status IN ('Rejected', 'Approved')) AND OLD.Status != NEW.Status THEN
        UPDATE Equipment e
        JOIN Booking_Equipment be ON e.EquipmentID = be.EquipmentID
        SET e.Status = 'Working'
        WHERE be.RequestID = NEW.RequestID
          AND e.Status = 'Reserved';   -- only reset Reserved items; leave Damaged/Under Repair alone
    END IF;
END //


DELIMITER ;


-- =================================================================================
-- SECTION 12: SAMPLE DATA (optional – demonstrates relationships)
-- =================================================================================

-- Admins
INSERT INTO Admin (Name, Email) VALUES
    ('Rajiv Sharma',   'rajiv.sharma@campus.edu'),
    ('Priya Mehta',    'priya.mehta@campus.edu');

-- Faculty
INSERT INTO Faculty (Name, Email, Department, Designation) VALUES
    ('Dr. Anil Kumar',  'anil.kumar@campus.edu',  'Computer Science', 'Professor'),
    ('Dr. Sunita Rao',  'sunita.rao@campus.edu',  'Electronics',      'Associate Professor');

-- Students
INSERT INTO Student (Name, Email, Department) VALUES
    ('Arjun Singh',   'arjun.singh@campus.edu',   'Computer Science'),
    ('Meera Patel',   'meera.patel@campus.edu',   'Electronics'),
    ('Rohan Verma',   'rohan.verma@campus.edu',   'Mechanical');

-- Societies
INSERT INTO Society (Name, Description, FoundedDate, FacultyPresidentID, StudentSecretaryID) VALUES
    ('Tech Club',   'Technology and coding society', '2018-06-01', 1, 1),
    ('Drama Club',  'Performing arts society',       '2015-03-15', 2, 2);

-- Society Members
INSERT INTO Society_Member (SocietyID, StudentID, Role, JoinedDate) VALUES
    (1, 1, 'Secretary',   '2022-07-01'),
    (1, 3, 'Member',      '2023-01-15'),
    (2, 2, 'Secretary',   '2021-08-01');

-- Resources
INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES
    ('Main Auditorium', 'Auditorium',   500, 'Block A', 'Active', 1),
    ('LT Hall',  'Seminar Hall', 150, 'Block B', 'Active', 1),
    ('LP Hall',  'Seminar Hall', 120, 'Block B', 'Active', 1),
    ('Tan Audi', 'Auditorium', 400, 'Block A', 'Active', 1),
    ('B block auditorium', 'Auditorium', 600, 'Block B', 'Active', 1),
    ('OAT', 'Auditorium', 800, 'Campus Center', 'Active', 1);

-- Equipment
INSERT INTO Equipment (Name, ResourceID, Status) VALUES
    ('Projector A',    1, 'Working'),
    ('Microphone Set', 1, 'Working'),
    ('Whiteboard',     2, 'Working');

-- Events
INSERT INTO Event (Name, SocietyID, EventDate, ExpectedAttendees) VALUES
    ('Annual Tech Fest',  1, '2025-11-20', 400),
    ('Drama Night 2025',  2, '2025-12-05', 150);

-- Booking Requests (submitted via sp_SubmitBooking in real usage)
-- StudentID 1 (Arjun Singh) is secretary of Society 1 (Tech Club)
-- StudentID 2 (Meera Patel) is secretary of Society 2 (Drama Club)
INSERT INTO Booking_Request (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status) VALUES
    (1, 1, 1, '2025-11-20', '09:00:00', '17:00:00', 'Pending'),
    (2, 2, 2, '2025-12-05', '18:00:00', '21:00:00', 'Pending');

-- Approvals
INSERT INTO Approval (RequestID, FacultyID, Status, Comments) VALUES
    (1, 1, 'Faculty Approved', 'Looks good, approved for Tech Fest.');

-- =================================================================================
-- END OF SCRIPT
-- =================================================================================
