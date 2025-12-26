#!/usr/bin/env python3
"""
Admin CLI for Tomato Focus Tracker

This script provides admin functionality for managing user accounts.
Only accessible to users with SSH access to the server.

Usage:
    python admin.py
"""

import sys
import os
from datetime import datetime
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import models
from app.database import DATABASE_URL


def get_db_session():
    """Create a database session"""
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def list_all_accounts(db):
    """List all user accounts with statistics"""
    print("\n" + "="*80)
    print("ALL USER ACCOUNTS")
    print("="*80)

    users = db.query(models.UserInformation).all()

    if not users:
        print("\nNo accounts found.")
        return

    print(f"\nTotal accounts: {len(users)}")
    print("\n{:<40} {:<15} {:<15}".format("EMAIL", "FOCUS SESSIONS", "CATEGORIES"))
    print("-"*80)

    for user in users:
        # Count focus sessions
        session_count = db.query(func.count(models.FocusInformation.time)).filter(
            models.FocusInformation.email == user.email
        ).scalar()

        # Count categories
        category_count = db.query(func.count(models.CategoryInformation.category)).filter(
            models.CategoryInformation.email == user.email
        ).scalar()

        print("{:<40} {:<15} {:<15}".format(
            user.email,
            session_count or 0,
            category_count or 0
        ))

    print("-"*80)


def view_account_details(db, email):
    """View detailed information about a specific account"""
    user = db.query(models.UserInformation).filter(
        models.UserInformation.email == email
    ).first()

    if not user:
        print(f"\nAccount '{email}' not found.")
        return

    print("\n" + "="*80)
    print(f"ACCOUNT DETAILS: {email}")
    print("="*80)

    # Get focus sessions count and total time
    sessions = db.query(
        func.count(models.FocusInformation.time).label('count'),
        func.sum(models.FocusInformation.focus_time_seconds).label('total_time')
    ).filter(
        models.FocusInformation.email == email
    ).first()

    session_count = sessions.count or 0
    total_time = sessions.total_time or 0
    total_hours = total_time / 3600 if total_time else 0

    print(f"\nFocus Sessions: {session_count}")
    print(f"Total Focus Time: {total_hours:.2f} hours ({total_time} seconds)")

    # Get categories
    categories = db.query(models.CategoryInformation.category).filter(
        models.CategoryInformation.email == email
    ).all()

    print(f"\nCategories ({len(categories)}):")
    for cat in categories:
        print(f"  - {cat.category}")

    # Get focus goals
    goals = db.query(models.FocusGoalInformation).filter(
        models.FocusGoalInformation.email == email
    ).all()

    print(f"\nFocus Goals ({len(goals)}):")
    for goal in goals:
        goal_hours = goal.goal_time_per_week_seconds / 3600
        print(f"  - {goal.category}: {goal_hours:.2f} hours/week")

    # Get last session date
    last_session = db.query(models.FocusInformation.time).filter(
        models.FocusInformation.email == email
    ).order_by(models.FocusInformation.time.desc()).first()

    if last_session:
        print(f"\nLast Session: {last_session.time}")
    else:
        print("\nLast Session: Never")

    print("="*80)


def delete_account(db, email):
    """Delete a user account and all associated data"""
    user = db.query(models.UserInformation).filter(
        models.UserInformation.email == email
    ).first()

    if not user:
        print(f"\nAccount '{email}' not found.")
        return False

    # Show what will be deleted
    print(f"\nWARNING: This will permanently delete the account '{email}' and ALL associated data:")

    session_count = db.query(func.count(models.FocusInformation.time)).filter(
        models.FocusInformation.email == email
    ).scalar()

    category_count = db.query(func.count(models.CategoryInformation.category)).filter(
        models.CategoryInformation.email == email
    ).scalar()

    goal_count = db.query(func.count(models.FocusGoalInformation.category)).filter(
        models.FocusGoalInformation.email == email
    ).scalar()

    print(f"  - {session_count or 0} focus sessions")
    print(f"  - {category_count or 0} categories")
    print(f"  - {goal_count or 0} focus goals")

    # Confirm deletion
    confirm = input("\nType 'DELETE' to confirm: ")
    if confirm != 'DELETE':
        print("Deletion cancelled.")
        return False

    # Delete the account (cascade will handle related data)
    db.delete(user)
    db.commit()

    print(f"\n✓ Account '{email}' has been successfully deleted.")
    return True


def show_account_limit_info(db):
    """Show current account count and limit"""
    user_count = db.query(func.count(models.UserInformation.email)).scalar()
    account_limit = 50

    print("\n" + "="*80)
    print("ACCOUNT LIMIT STATUS")
    print("="*80)
    print(f"\nCurrent accounts: {user_count}/{account_limit}")
    print(f"Available slots: {account_limit - user_count}")

    if user_count >= account_limit:
        print("\n⚠️  WARNING: Account limit reached! New registrations will be blocked.")
    elif user_count >= account_limit * 0.9:
        print(f"\n⚠️  WARNING: Approaching account limit ({user_count}/{account_limit})")

    print("="*80)


def main_menu():
    """Display the main menu and handle user input"""
    db = get_db_session()

    try:
        while True:
            print("\n" + "="*80)
            print("TOMATO FOCUS TRACKER - ADMIN PANEL")
            print("="*80)
            print("\n1. List all accounts")
            print("2. View account details")
            print("3. Delete account")
            print("4. Check account limit status")
            print("5. Exit")
            print("\n" + "-"*80)

            choice = input("\nEnter your choice (1-5): ").strip()

            if choice == '1':
                list_all_accounts(db)

            elif choice == '2':
                email = input("\nEnter account email: ").strip()
                view_account_details(db, email)

            elif choice == '3':
                email = input("\nEnter account email to delete: ").strip()
                delete_account(db, email)

            elif choice == '4':
                show_account_limit_info(db)

            elif choice == '5':
                print("\nExiting admin panel. Goodbye!")
                break

            else:
                print("\n❌ Invalid choice. Please enter a number between 1 and 5.")

    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*80)
    print("TOMATO FOCUS TRACKER - ADMIN CLI")
    print("="*80)
    print("\nThis tool allows you to manage user accounts.")
    print("Only run this on the server with proper authentication.\n")

    try:
        main_menu()
    except KeyboardInterrupt:
        print("\n\nAdmin panel closed by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)
