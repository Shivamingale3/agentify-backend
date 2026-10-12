# Feature Outline

### Register

1. Take details from request
2. check if user exists. if do throw error
3. If not add user
4. Create a verification link and put the task to DB and redis
5. put the task "Email the link for verification" into queue

### Verify Email

1. Extract token
2. try token in cache if not found query
3. validate token
4. Mark user as verified
5. Delete task from DB and cache

### Login

-> Email & password + MFA (if enabled).
