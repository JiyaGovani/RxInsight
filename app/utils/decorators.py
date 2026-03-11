from functools import wraps
from flask import session, redirect, url_for, flash, request, jsonify

def login_required(f):
    """
    Decorator to require user login for a route.
    If user is not logged in (no 'user_id' in session),
    - For AJAX/API requests, returns a JSON error with 401 status.
    - For normal web requests, flashes a warning and redirects to login page.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is logged in
        if 'user_id' not in session:
            # Gather request headers to determine request type
            content_type = (request.content_type or '').lower()
            accept_header = (request.headers.get('Accept') or '').lower()
            sec_fetch_mode = (request.headers.get('Sec-Fetch-Mode') or '').lower()
            sec_fetch_dest = (request.headers.get('Sec-Fetch-Dest') or '').lower()

            # Determine if request expects JSON (AJAX/API)
            expects_json = (
                request.is_json
                or request.headers.get('X-Requested-With') == 'XMLHttpRequest'
                or 'application/json' in content_type
                or 'multipart/form-data' in content_type
                or 'application/json' in accept_header
            )

            # Check if request is programmatic (not a normal browser navigation)
            is_programmatic_request = (
                sec_fetch_mode in {'cors', 'same-origin', 'no-cors'}
                and sec_fetch_dest in {'', 'empty'}
            )

            # If AJAX/API or programmatic, return JSON error
            if expects_json or is_programmatic_request:
                return jsonify(success=False, error='You need to be logged in'), 401
            # Otherwise, show warning and redirect to login page
            flash('You need to be logged in to access this page.', 'warning')
            return redirect(url_for('auth.login_page'))
        # If logged in, proceed to the original function
        return f(*args, **kwargs)
    return decorated_function
