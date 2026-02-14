from functools import wraps
from flask import session, redirect, url_for, flash, request, jsonify

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # For AJAX/fetch requests, return JSON instead of redirecting
            if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.content_type and 'multipart/form-data' in request.content_type:
                return jsonify(success=False, error='You need to be logged in'), 401
            flash('You need to be logged in to access this page.', 'warning')
            return redirect(url_for('auth.login_page'))
        return f(*args, **kwargs)
    return decorated_function
