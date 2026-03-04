import sqlite3
import datetime
import uuid
import random

def generate_id():
    return str(uuid.uuid4()).replace('-', '')[:25]

def get_now():
    return datetime.datetime.now().isoformat() + "Z"

def seed():
    conn = sqlite3.connect('dev.db')
    cursor = conn.cursor()

    now = get_now()

    try:
        # Clear existing data
        tables = [
            'InstructorAssignment', 'StudentEnrollment', 'ExamAssignmentRoom',
            'ExamAssignment', 'DistributionConstraint', 'RoomPreference',
            'PeriodPreference', 'ExamOwner', 'Exam', 'ExamPeriod',
            'RoomPeriodAvailability', 'RoomFeatureAssignment', 'Room',
            'Building', 'Section', 'Course', 'Subject', 'Department',
            'ExamType', 'AcademicSession', 'Instructor', 'Student'
        ]
        
        print("Cleaning up existing data...")
        for table in tables:
            cursor.execute(f"DELETE FROM {table}")

        print("Seeding realistic minimal dataset...")

        # 1. Academic Sessions
        sessions = []
        for name, isActive in [("Spring 2025", 1), ("Fall 2024", 0)]:
            session_id = generate_id()
            cursor.execute("""
                INSERT INTO AcademicSession (id, name, year, term, startDate, endDate, isActive, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, name, 2024 if "2024" in name else 2025, name.split()[0], 
                  "2025-01-01T00:00:00Z", "2025-05-31T00:00:00Z", isActive, now, now))
            sessions.append(session_id)
        
        active_session_id = sessions[0]

        # 2. Departments & Subjects
        subject_map = {}
        for code, name in [("CS", "Computer Science"), ("MATH", "Mathematics"), ("PHY", "Physics")]:
            dept_id = generate_id()
            cursor.execute("INSERT INTO Department (id, code, name, sessionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                           (dept_id, code, name, active_session_id, now, now))
            
            # One subject per department for simplicity
            subj_id = generate_id()
            cursor.execute("INSERT INTO Subject (id, code, name, departmentId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                           (subj_id, code, name, dept_id, now, now))
            subject_map[code] = subj_id

        # 3. Exam Types
        etypes = []
        for name, code in [("Midterm", "MID"), ("Final", "FINAL")]:
            etype_id = generate_id()
            cursor.execute("INSERT INTO ExamType (id, name, code, sessionId) VALUES (?, ?, ?, ?)",
                           (etype_id, name, code, active_session_id))
            etypes.append(etype_id)

        # 4. Rooms and Buildings
        rooms = []
        for bcode in ["ENG", "SCI"]:
            bld_id = generate_id()
            cursor.execute("INSERT INTO Building (id, code, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
                           (bld_id, bcode, f"{bcode} Building", now, now))
            for i in range(1, 4):
                room_id = generate_id()
                cursor.execute("INSERT INTO Room (id, name, buildingId, capacity, altCapacity, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                               (room_id, f"{bcode}{100+i}", bld_id, 50, 25, now, now))
                rooms.append(room_id)

        # 5. Exam Periods (6 periods)
        periods = []
        for day in range(1, 4):
            for slot, (start, end) in enumerate([("09:00", "11:00"), ("14:00", "16:00")]):
                period_id = generate_id()
                cursor.execute("""
                    INSERT INTO ExamPeriod (id, examTypeId, date, startTime, endTime, length, day, timeIndex, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (period_id, etypes[1], f"2025-05-{20+day}T00:00:00Z", start, end, 120, day, slot, now, now))
                periods.append(period_id)

        # 6. Instructors
        instructors = []
        for i in range(5):
            inst_id = generate_id()
            cursor.execute("INSERT INTO Instructor (id, externalId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
                           (inst_id, f"I300{i}", f"Prof. {['Smith', 'Jones', 'Wang', 'Miller', 'Davis'][i]}", now, now))
            instructors.append(inst_id)

        # 7. Courses, Sections, Exams
        courses = []
        all_exams = []
        section_to_exam = {}
        
        course_data = [
            ("CS", "101", "Intro to CS"), ("CS", "201", "Data Structures"), ("CS", "301", "Algorithms"),
            ("CS", "401", "Operating Systems"), ("MATH", "101", "Calculus I"), ("MATH", "102", "Calculus II"),
            ("MATH", "201", "Linear Algebra"), ("PHY", "101", "Mechanics"), ("PHY", "102", "Electromagnetism"),
            ("PHY", "201", "Modern Physics")
        ]

        for i, (dept_code, num, title) in enumerate(course_data):
            subj_id = subject_map[dept_code]
            
            course_id = generate_id()
            cursor.execute("INSERT INTO Course (id, courseNumber, title, subjectId, sessionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (course_id, num, title, subj_id, active_session_id, now, now))
            
            sec_id = generate_id()
            cursor.execute("INSERT INTO Section (id, sectionNumber, courseId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
                           (sec_id, "001", course_id, now, now))
            
            exam_id = generate_id()
            cursor.execute("INSERT INTO Exam (id, name, examTypeId, length, size, minSize, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                           (exam_id, f"{dept_code}{num} Final", etypes[1], 120, 30, 0, now, now))
            
            cursor.execute("INSERT INTO ExamOwner (id, examId, sectionId) VALUES (?, ?, ?)",
                           (generate_id(), exam_id, sec_id))
            
            # Assign random instructor
            cursor.execute("INSERT INTO InstructorAssignment (id, instructorId, examId) VALUES (?, ?, ?)",
                           (generate_id(), random.choice(instructors), exam_id))
            
            all_exams.append(exam_id)
            section_to_exam[sec_id] = exam_id
            courses.append(sec_id)

        # 8. Students & Enrollments (50 students)
        for i in range(50):
            stu_id = generate_id()
            cursor.execute("INSERT INTO Student (id, externalId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
                           (stu_id, f"S400{i}", f"Student {i}", now, now))
            
            # Enroll in 3-5 random courses to create conflicts
            my_secs = random.sample(courses, random.randint(3, 5))
            for sec_id in my_secs:
                cursor.execute("INSERT INTO StudentEnrollment (id, studentId, sectionId, examId) VALUES (?, ?, ?, ?)",
                               (generate_id(), stu_id, sec_id, section_to_exam[sec_id]))

        conn.commit()
        print(f"Generated:")
        print(f"- 2 Sessions")
        print(f"- 10 Courses/Exams")
        print(f"- 50 Students with overlapping enrollments")
        print(f"- 5 Instructors")
        print(f"- 6 Exam Periods")
        print(f"- 6 Rooms")
        print("Database seeded successfully!")

    except sqlite3.Error as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed()
