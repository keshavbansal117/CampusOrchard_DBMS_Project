import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/halls', (req, res) => {
    try {
      const halls = db.prepare(`
        SELECT ResourceID as id, Name as name, Location as building, Capacity as capacity, 'Standard' as features, Status as status 
        FROM Resource
      `).all();
      res.json(halls);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/halls', (req, res) => {
    try {
      const { name, type, capacity, location } = req.body;
      const stmt = db.prepare("INSERT INTO Resource (Name, Type, Capacity, Location, Status, UpdatedByAdminID) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run(name, type || 'Seminar Hall', capacity || 100, location || 'Block A', 'Active', 1);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/halls/:id', (req, res) => {
    try {
      const { name, capacity, location, status } = req.body;
      const stmt = db.prepare("UPDATE Resource SET Name = ?, Capacity = ?, Location = ?, Status = ?, UpdatedByAdminID = ? WHERE ResourceID = ?");
      stmt.run(name, capacity, location, status, 1, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/users', (req, res) => {
    try {
      const users = db.prepare(`
        SELECT StudentID as id, Name as name, 'Student' as role, Department as department, Email as email, Phone as phone FROM Student
        UNION
        SELECT FacultyID as id, Name as name, Designation as role, Department as department, Email as email, Phone as phone FROM Faculty
      `).all();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/logs', (req, res) => {
    try {
      const logs = db.prepare(`
        SELECT l.LogID, a.Name as AdminName, l.ActionType as Action, l.ActionTime
        FROM Admin_Log l
        JOIN Admin a ON l.AdminID = a.AdminID
        ORDER BY l.ActionTime DESC
      `).all();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/action', (req, res) => {
    try {
      const { type, bookingId, role } = req.body;
      
      if (type === 'faculty_approve') {
        db.prepare("INSERT INTO Approval (RequestID, FacultyID, Status, Comments) VALUES (?, ?, ?, ?)").run(bookingId, 1, 'Faculty Approved', 'Approved by Faculty');
      } else if (type === 'admin_verify') {
        db.prepare("UPDATE Approval SET Status = 'Approved', AdminID = 1 WHERE RequestID = ?").run(bookingId);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/bookings', (req, res) => {
    try {
      const bookings = db.prepare(`
        SELECT 
          br.RequestID as bookingId, 
          br.ResourceID as hallId, 
          br.SubmittedByStudentID as userId, 
          e.Name as eventName, 
          br.BookingDate as date, 
          br.StartTime as startTime, 
          br.EndTime as endTime, 
          br.Status as status, 
          a.Comments as rejectionReason,
          r.Name as hallName,
          st.Name as userName
        FROM Booking_Request br
        JOIN Event e ON br.EventID = e.EventID
        JOIN Resource r ON br.ResourceID = r.ResourceID
        JOIN Student st ON br.SubmittedByStudentID = st.StudentID
        LEFT JOIN Approval a ON br.RequestID = a.RequestID
      `).all();
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bookings', (req, res) => {
    try {
      const { resourceId, eventName, date, startTime, endTime } = req.body;
      const studentId = 1; // Simulated student ID for submission
      
      // 1. Time sanity check
      if (startTime >= endTime) {
        throw new Error('StartTime must be before EndTime.');
      }
      
      db.exec('BEGIN TRANSACTION');
      
      // 2. Lock and validate resource (Simulation using SELECT instead of FOR UPDATE)
      const resource = db.prepare('SELECT Status, Capacity FROM Resource WHERE ResourceID = ?').get(resourceId) as any;
      if (!resource || resource.Status !== 'Active') {
        throw new Error('Resource is not available (Maintenance or Inactive).');
      }
      
      const expectedAttendees = 100; // Hardcoded for this form, alternatively could be sent
      if (expectedAttendees > resource.Capacity) {
        throw new Error('ExpectedAttendees exceeds Resource capacity.');
      }
      
      // Check availability (fn_CheckAvailability)
      const conflict = db.prepare(`
        SELECT COUNT(*) as count 
        FROM Booking_Request 
        WHERE ResourceID = ? 
          AND BookingDate = ? 
          AND Status IN ('Pending', 'Pending Admin', 'Approved') 
          AND (? < EndTime AND ? > StartTime)
      `).get(resourceId, date, startTime, endTime) as any;
      
      if (conflict.count > 0) {
        throw new Error('Resource is already booked for the requested time slot.');
      }
      
      // Secretary validation
      const societyId = 1;
      const society = db.prepare('SELECT StudentSecretaryID FROM Society WHERE SocietyID = ?').get(societyId) as any;
      if (society.StudentSecretaryID !== studentId) {
        throw new Error('Only the Student Secretary of the society can submit a booking request.');
      }
      
      const insertEvent = db.prepare(`INSERT INTO Event (Name, SocietyID, EventDate, ExpectedAttendees) VALUES (?, ?, ?, ?)`).run(eventName, societyId, date, expectedAttendees);
      const eventId = insertEvent.lastInsertRowid;
      
      const stmt = db.prepare(`
        INSERT INTO Booking_Request (EventID, ResourceID, SubmittedByStudentID, BookingDate, StartTime, EndTime, Status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(eventId, resourceId, studentId, date, startTime, endTime, 'Pending');
      db.exec('COMMIT');
      res.json({ success: true });
    } catch (error: any) {
      if (db.inTransaction) db.exec('ROLLBACK');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sql', (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query is required' });
      }
      
      const isSelect = query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().startsWith('PRAGMA');
      
      if (isSelect) {
        const result = db.prepare(query).all();
        res.json({ success: true, data: result });
      } else {
        const result = db.prepare(query).run();
        res.json({ success: true, data: result });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
