from functools import wraps
from flask import session, redirect, url_for, flash, request, jsonify

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # For AJAX/fetch/API requests, return JSON instead of redirecting to login HTML
            content_type = (request.content_type or '').lower()
            accept_header = (request.headers.get('Accept') or '').lower()
            sec_fetch_mode = (request.headers.get('Sec-Fetch-Mode') or '').lower()
            sec_fetch_dest = (request.headers.get('Sec-Fetch-Dest') or '').lower()

            expects_json = (
                request.is_json
                or request.headers.get('X-Requested-With') == 'XMLHttpRequest'
                or 'application/json' in content_type
                or 'multipart/form-data' in content_type
                or 'application/json' in accept_header
            )

            is_programmatic_request = (
                sec_fetch_mode in {'cors', 'same-origin', 'no-cors'}
                and sec_fetch_dest in {'', 'empty'}
            )

            if expects_json or is_programmatic_request:
                return jsonify(success=False, error='You need to be logged in'), 401
            flash('You need to be logged in to access this page.', 'warning')
            return redirect(url_for('auth.login_page'))
        return f(*args, **kwargs)
    return decorated_function
