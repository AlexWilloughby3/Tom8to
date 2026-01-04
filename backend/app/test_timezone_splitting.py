#!/usr/bin/env python3
"""
Test script to verify timezone handling and midnight session splitting.

This script tests that a 30-minute session ending at 12:15 AM EST gets split into:
- Session 1: Previous day 11:45 PM - 12:00 AM (15 minutes = 900 seconds)
- Session 2: Current day 12:00 AM - 12:15 AM (15 minutes = 900 seconds)
"""

import sys
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import crud, schemas
from app import timezone_utils

EASTERN = ZoneInfo("America/New_York")

def test_midnight_split():
    """Test that a session crossing midnight gets split correctly"""
    db = SessionLocal()

    try:
        print("=" * 80)
        print("TIMEZONE SPLITTING TEST")
        print("=" * 80)

        # Test email (make sure this user exists in your database)
        test_email = "test@example.com"

        # Create a test time: 12:15 AM EST (midnight + 15 minutes)
        # This will be used as the END time of the session
        test_date = datetime.now(EASTERN).replace(hour=0, minute=15, second=0, microsecond=0)

        print(f"\n📅 Test Date: {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
        print(f"   (End time of focus session)")

        # Create a 30-minute (1800 seconds) focus session ending at 12:15 AM
        # This should start at 11:45 PM the previous day
        duration_seconds = 1800  # 30 minutes
        start_time = test_date - timedelta(seconds=duration_seconds)

        print(f"\n⏱️  Session Duration: {duration_seconds} seconds (30 minutes)")
        print(f"   Start: {start_time.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
        print(f"   End:   {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")

        # Check if user exists, if not create them
        user = crud.get_user(db, test_email)
        if not user:
            print(f"\n⚠️  User {test_email} doesn't exist. Creating test user...")
            user_create = schemas.UserCreate(email=test_email, password="testpassword123")
            user = crud.create_user(db, user_create)
            print(f"✅ Created user: {test_email}")
        else:
            print(f"\n✅ Using existing user: {test_email}")

        # Delete any existing sessions for this user and category to start clean
        print(f"\n🧹 Cleaning up old test sessions...")
        db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory"
        ).delete()
        db.commit()

        # Create the focus session
        print(f"\n🚀 Creating focus session...")
        session_create = schemas.FocusSessionCreate(
            category="TestCategory",
            focus_time_seconds=duration_seconds
        )

        result = crud.create_focus_session(
            db=db,
            email=test_email,
            focus_session=session_create,
            time=test_date  # End time
        )

        print(f"✅ Focus session created!")

        # Query all sessions for this user and category
        print(f"\n🔍 Querying database for created sessions...")
        sessions = db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory"
        ).order_by(crud.models.FocusInformation.time).all()

        print(f"\n📊 RESULTS:")
        print(f"   Total sessions created: {len(sessions)}")
        print()

        if len(sessions) == 2:
            print("✅ SUCCESS! Session was split into 2 sessions")
            print()

            total_duration = 0
            for i, session in enumerate(sessions, 1):
                # Database stores as naive UTC, so treat it as UTC first, then convert to Eastern
                if session.time.tzinfo is None:
                    # Naive datetime - assume it's UTC
                    session_time_utc = session.time.replace(tzinfo=ZoneInfo("UTC"))
                    session_time_eastern = session_time_utc.astimezone(EASTERN)
                else:
                    session_time_eastern = timezone_utils.utc_to_eastern(session.time)

                session_start = session_time_eastern - timedelta(seconds=session.focus_time_seconds)

                print(f"   Session {i}:")
                print(f"      Start:    {session_start.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
                print(f"      End:      {session_time_eastern.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
                print(f"      Duration: {session.focus_time_seconds} seconds ({session.focus_time_seconds / 60} minutes)")
                print(f"      Category: {session.category}")
                print()

                total_duration += session.focus_time_seconds

            print(f"   Total duration: {total_duration} seconds (should be {duration_seconds})")

            if total_duration == duration_seconds:
                print("   ✅ Duration matches original session!")
            else:
                print(f"   ❌ Duration mismatch! Expected {duration_seconds}, got {total_duration}")

            # Verify the split is correct
            # Convert naive UTC to Eastern for comparison
            if sessions[0].time.tzinfo is None:
                session1_end = sessions[0].time.replace(tzinfo=ZoneInfo("UTC")).astimezone(EASTERN)
            else:
                session1_end = timezone_utils.utc_to_eastern(sessions[0].time)

            if sessions[1].time.tzinfo is None:
                session2_end = sessions[1].time.replace(tzinfo=ZoneInfo("UTC")).astimezone(EASTERN)
            else:
                session2_end = timezone_utils.utc_to_eastern(sessions[1].time)

            # Session 1 should end at midnight
            midnight = session1_end.replace(hour=0, minute=0, second=0, microsecond=0)
            if session1_end.date() < session2_end.date():
                # Session 1 is on previous day, should end at midnight of next day
                midnight = midnight + timedelta(days=1)

            print(f"\n   Verification:")
            if sessions[0].focus_time_seconds == 900 and sessions[1].focus_time_seconds == 900:
                print(f"   ✅ Both sessions are 15 minutes (900 seconds)")
            else:
                print(f"   ⚠️  Session durations: {sessions[0].focus_time_seconds}s and {sessions[1].focus_time_seconds}s")

            # Check if first session ends at midnight (which means it was split correctly)
            session1_start = session1_end - timedelta(seconds=sessions[0].focus_time_seconds)
            session2_start = session2_end - timedelta(seconds=sessions[1].focus_time_seconds)

            # Session 1 should start on previous day and end at midnight
            # Session 2 should start at midnight
            if (session1_start.date() < session1_end.date() and
                session1_end.hour == 0 and session1_end.minute == 0 and
                session2_start.hour == 0 and session2_start.minute == 0):
                print(f"   ✅ Sessions correctly split at midnight boundary")
                print(f"      Session 1: {session1_start.date()} (before midnight)")
                print(f"      Session 2: {session2_start.date()} (after midnight)")
            else:
                print(f"   ⚠️  Unexpected split pattern")
                print(f"      Session 1: {session1_start} → {session1_end}")
                print(f"      Session 2: {session2_start} → {session2_end}")

        elif len(sessions) == 1:
            print("❌ FAILED! Session was NOT split (expected 2 sessions, got 1)")
            session = sessions[0]
            # Convert naive UTC to Eastern
            if session.time.tzinfo is None:
                session_time_eastern = session.time.replace(tzinfo=ZoneInfo("UTC")).astimezone(EASTERN)
            else:
                session_time_eastern = timezone_utils.utc_to_eastern(session.time)
            print(f"\n   Single session:")
            print(f"      End time: {session_time_eastern.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
            print(f"      Duration: {session.focus_time_seconds} seconds")
        else:
            print(f"❌ UNEXPECTED! Got {len(sessions)} sessions (expected 2)")

        # Cleanup
        print(f"\n🧹 Cleaning up test data...")
        db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory"
        ).delete()
        db.commit()
        print("✅ Test data cleaned up")

        print("\n" + "=" * 80)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def test_no_split():
    """Test that a session NOT crossing midnight doesn't get split"""
    db = SessionLocal()

    try:
        print("\n" + "=" * 80)
        print("NORMAL SESSION TEST (No Midnight Crossing)")
        print("=" * 80)

        test_email = "test@example.com"

        # Create a test time: 2:00 PM EST
        test_date = datetime.now(EASTERN).replace(hour=14, minute=0, second=0, microsecond=0)

        print(f"\n📅 Test Date: {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")

        duration_seconds = 1800  # 30 minutes
        start_time = test_date - timedelta(seconds=duration_seconds)

        print(f"\n⏱️  Session Duration: {duration_seconds} seconds (30 minutes)")
        print(f"   Start: {start_time.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
        print(f"   End:   {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")

        # Create the focus session
        print(f"\n🚀 Creating focus session...")
        session_create = schemas.FocusSessionCreate(
            category="TestCategory2",
            focus_time_seconds=duration_seconds
        )

        crud.create_focus_session(
            db=db,
            email=test_email,
            focus_session=session_create,
            time=test_date
        )

        # Query sessions
        sessions = db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory2"
        ).all()

        print(f"\n📊 RESULTS:")
        print(f"   Total sessions created: {len(sessions)}")

        if len(sessions) == 1:
            print("✅ SUCCESS! Session was NOT split (as expected)")
            session = sessions[0]
            # Convert naive UTC to Eastern
            if session.time.tzinfo is None:
                session_time_eastern = session.time.replace(tzinfo=ZoneInfo("UTC")).astimezone(EASTERN)
            else:
                session_time_eastern = timezone_utils.utc_to_eastern(session.time)
            print(f"   Duration: {session.focus_time_seconds} seconds")
            print(f"   End time: {session_time_eastern.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
        else:
            print(f"❌ UNEXPECTED! Got {len(sessions)} sessions (expected 1)")

        # Cleanup
        db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory2"
        ).delete()
        db.commit()

        print("\n" + "=" * 80)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def test_evening_session():
    """Test that a 7:15 PM EST session for 30 minutes is stored correctly in UTC"""
    db = SessionLocal()

    try:
        print("\n" + "=" * 80)
        print("EVENING SESSION TEST (7:15 PM EST)")
        print("=" * 80)

        test_email = "test@example.com"

        # Create a test time: 7:15 PM EST (19:15)
        # This is in the evening, so UTC will be the NEXT day (because UTC is 5 hours ahead during EST)
        test_date = datetime.now(EASTERN).replace(hour=19, minute=15, second=0, microsecond=0)

        print(f"\n📅 Test Date: {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
        print(f"   (End time of focus session)")

        duration_seconds = 1800  # 30 minutes
        start_time = test_date - timedelta(seconds=duration_seconds)

        print(f"\n⏱️  Session Duration: {duration_seconds} seconds (30 minutes)")
        print(f"   Start: {start_time.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
        print(f"   End:   {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")

        # Convert to UTC to show what should be stored in database
        test_date_utc = timezone_utils.eastern_to_utc(test_date).replace(tzinfo=None)
        print(f"\n🌍 Expected UTC storage:")
        print(f"   Database should store: {test_date_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"   (Note: UTC is {(test_date_utc.hour - test_date.hour) % 24} hours ahead)")

        # Create the focus session
        print(f"\n🚀 Creating focus session...")
        session_create = schemas.FocusSessionCreate(
            category="TestCategory3",
            focus_time_seconds=duration_seconds
        )

        crud.create_focus_session(
            db=db,
            email=test_email,
            focus_session=session_create,
            time=test_date
        )

        # Query sessions
        sessions = db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory3"
        ).all()

        print(f"\n📊 RESULTS:")
        print(f"   Total sessions created: {len(sessions)}")

        if len(sessions) == 1:
            print("✅ SUCCESS! Session was NOT split (correct - doesn't cross midnight)")
            session = sessions[0]

            # Show what's actually stored in database (naive UTC)
            print(f"\n   Database stored time (naive UTC): {session.time}")
            print(f"   Duration: {session.focus_time_seconds} seconds")

            # Convert back to Eastern for verification
            if session.time.tzinfo is None:
                session_time_utc = session.time.replace(tzinfo=ZoneInfo("UTC"))
                session_time_eastern = session_time_utc.astimezone(EASTERN)
            else:
                session_time_eastern = timezone_utils.utc_to_eastern(session.time)

            print(f"\n   When converted back to Eastern:")
            print(f"   End time: {session_time_eastern.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")

            # Verify it matches our input
            if session_time_eastern.date() == test_date.date() and \
               session_time_eastern.hour == test_date.hour and \
               session_time_eastern.minute == test_date.minute:
                print(f"\n   ✅ Time conversion is CORRECT!")
                print(f"   Input:  {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
                print(f"   Output: {session_time_eastern.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
            else:
                print(f"\n   ❌ Time conversion MISMATCH!")
                print(f"   Expected: {test_date.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")
                print(f"   Got:      {session_time_eastern.strftime('%Y-%m-%d %I:%M:%S %p %Z')}")

            # Verify UTC storage
            if session.time == test_date_utc:
                print(f"\n   ✅ Database storage is CORRECT!")
                print(f"   Stored as UTC: {session.time} (naive)")
            else:
                print(f"\n   ⚠️  Database storage discrepancy:")
                print(f"   Expected: {test_date_utc}")
                print(f"   Got:      {session.time}")

        else:
            print(f"❌ UNEXPECTED! Got {len(sessions)} sessions (expected 1)")

        # Cleanup
        db.query(crud.models.FocusInformation).filter(
            crud.models.FocusInformation.email == test_email,
            crud.models.FocusInformation.category == "TestCategory3"
        ).delete()
        db.commit()

        print("\n" + "=" * 80)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("\n🧪 Starting timezone and session splitting tests...\n")

    # Test 1: Session crossing midnight should be split
    test_midnight_split()

    # Test 2: Normal session should NOT be split
    test_no_split()

    # Test 3: Evening session (7:15 PM EST) should be stored correctly in UTC
    test_evening_session()

    print("\n✨ Tests complete!\n")
