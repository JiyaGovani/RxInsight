import psycopg
import os
from dotenv import load_dotenv

load_dotenv()

con = None

def get_connection():
    global con
    
    # Check if connection is None or closed
    if con is None or con.closed:
        con = psycopg.connect(
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            # Make sure unqualified table names (like "users") use the public schema.
            # This avoids writing to/reading from a different schema than what you view in pgAdmin.
            options="-c search_path=public",
        )
    else:
        # Test if the connection is still alive
        try:
            with con.cursor() as cur:
                cur.execute("SELECT 1")
        except Exception:
            try:
                con.close()
            except:
                pass
            con = psycopg.connect(
                dbname=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                host=os.getenv("DB_HOST"),
                port=os.getenv("DB_PORT"),
                options="-c search_path=public",
            )
    
    return con