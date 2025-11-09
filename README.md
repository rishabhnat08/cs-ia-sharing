# Environment Configuration

Developers should create a local `.env` file (which remains untracked thanks to the repository `.gitignore`) and populate it with the credentials required for AI integrations:

```
GOOGLE_API_KEY=your-google-key
GEMINI_API_KEY=your-gemini-key
```

Production deployments must not rely on this file. Instead, they should source credentials from the environment-specific secret management solution for the target platform so that keys are rotated and managed securely.
