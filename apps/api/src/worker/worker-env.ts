// Imported by worker-main.ts before the app modules, so the environment is validated with it:
// the worker exists to run the background jobs, whatever the shared task environment says.
process.env.BACKGROUND_JOBS = 'true';
process.env.NIXZORA_PROCESS = 'worker';
