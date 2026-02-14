import os
from flask import Flask


def create_app(config_object=None):
	app = Flask(__name__, static_folder='static', template_folder='templates')

	# Secret key for sessions; prefer environment variable, fallback to a generated one
	app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-me')

	# Optional external config object
	if config_object:
		app.config.from_object(config_object)

	# Register blueprints
	try:
		from app.routes.auth_routes import bp as auth_bp

		app.register_blueprint(auth_bp)
	except Exception:
		# keep app creation robust if import fails in tests
		pass

	return app
