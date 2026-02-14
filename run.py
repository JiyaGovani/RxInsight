import os

from flask import Flask, render_template, redirect, session
from dotenv import load_dotenv


load_dotenv()  # loads .env file

# Create Flask app instance with custom template folder
app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
app.secret_key = os.getenv("SECRET_KEY", "change-me")  # fetch from environment

# Register auth routes (registration endpoint lives here now)
from app.routes.auth_routes import bp as auth_bp
from app.routes.prescription import bp as prescription_bp
from app.routes.reminder import bp as reminder_bp

app.register_blueprint(auth_bp)
app.register_blueprint(prescription_bp)
app.register_blueprint(reminder_bp)


@app.route("/")
def home_page():
    return render_template("index.html")

@app.route("/dashboard")
def user_dashboard():
    if not session.get("user_id"):
        return redirect("/login")
    # If an admin hits /dashboard, send them to the admin dashboard.
    if session.get("role") == 1:
        return redirect("/admin")
    return render_template("user/dashboard.html", username=session.get("username"))

@app.route("/admin")
def admin_dashboard():
    if not session.get("user_id"):
        return redirect("/login")
    # Only admins can view /admin
    if session.get("role") != 1:
        return redirect("/dashboard")
    return render_template("admin/dashboard.html", username=session.get("username"))


if __name__ == "__main__":
    app.run(debug=True)

