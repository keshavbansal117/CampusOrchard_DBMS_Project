export const data = {
  halls: [
    {
      id: "SH-001",
      name: "Turing Auditorium",
      building: "CS Dept, Block A",
      capacity: 350,
      features: ["Projector", "AC", "PA System", "Stage", "Wi-Fi"],
      status: "Active"
    },
    {
      id: "SH-002",
      name: "Lovelace Seminar Room",
      building: "CS Dept, Block A",
      capacity: 60,
      features: ["Smartboard", "AC", "Wi-Fi"],
      status: "Active"
    },
    {
      id: "SH-003",
      name: "Newton Hall",
      building: "Science Block, C",
      capacity: 120,
      features: ["Projector", "Whiteboard", "Podcasing setup"],
      status: "Active"
    },
    {
      id: "SH-004",
      name: "The Da Vinci Hub",
      building: "Design Dept, Block E",
      capacity: 80,
      features: ["Surround Sound", "Movable Seating", "AC"],
      status: "Active"
    },
    {
      id: "SH-005",
      name: "Keynes Conference Room",
      building: "Business School",
      capacity: 30,
      features: ["Video Conferencing", "Smart TV", "AC"],
      status: "Maintenance"
    }
  ],
  users: [
    {
      id: "U-101",
      name: "Dr. Rajesh Kumar",
      role: "Faculty",
      department: "Computer Science",
      email: "r.kumar@univ.edu",
      phone: "+91-9876543210"
    },
    {
      id: "U-102",
      name: "Prof. Anita Desai",
      role: "HOD",
      department: "Business Admin",
      email: "a.desai@univ.edu",
      phone: "+91-9876543211"
    },
    {
      id: "U-103",
      name: "Rohan Sharma",
      role: "Student Rep",
      department: "Cultural Comm.",
      email: "rohan.s@student.edu",
      phone: "+91-9876543212"
    },
    {
      id: "U-104",
      name: "Dr. Emily Chen",
      role: "Faculty",
      department: "Physics",
      email: "e.chen@univ.edu",
      phone: "+91-9876543213"
    }
  ],
  bookings: [
    {
      bookingId: "B-5001",
      hallId: "SH-001",
      userId: "U-101",
      eventName: "AI & ML Tech Symposium",
      date: "2026-04-15",
      startTime: "09:00",
      endTime: "16:00",
      status: "Approved"
    },
    {
      bookingId: "B-5002",
      hallId: "SH-003",
      userId: "U-104",
      eventName: "Quantum Physics Guest Lecture",
      date: "2026-04-16",
      startTime: "14:00",
      endTime: "16:00",
      status: "Approved"
    },
    {
      bookingId: "B-5003",
      hallId: "SH-005",
      userId: "U-102",
      eventName: "Faculty Board Meeting",
      date: "2026-04-18",
      startTime: "10:00",
      endTime: "12:00",
      status: "Pending"
    },
    {
      bookingId: "B-5004",
      hallId: "SH-002",
      userId: "U-103",
      eventName: "Debate Club Auditions",
      date: "2026-04-20",
      startTime: "15:00",
      endTime: "18:00",
      status: "Rejected",
      rejectionReason: "Clashes with scheduled maintenance."
    },
    {
      bookingId: "B-5005",
      hallId: "SH-001",
      userId: "U-103",
      eventName: "Annual Cultural Fest Prep",
      date: "2026-04-22",
      startTime: "09:00",
      endTime: "13:00",
      status: "Pending"
    }
  ]
};
