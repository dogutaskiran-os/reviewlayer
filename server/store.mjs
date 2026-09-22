import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function toProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    reviewCodeHash: row.review_code_hash,
    allowedOrigins: parseJson(row.allowed_origins, []),
    createdAt: row.created_at,
  };
}

function toAnnotation(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id, comment: row.comment,
    anchor: parseJson(row.anchor, {}), page: parseJson(row.page, {}),
    status: row.status, createdAt: row.created_at,
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  };
}

function toUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

function toWorkspace(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, slug: row.slug, role: row.role || "owner",
    plan: row.plan, trialEndsAt: row.trial_ends_at, createdAt: row.created_at,
  };
}

export function createStore({ databasePath }) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
      created_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      review_code_hash TEXT NOT NULL,
      allowed_origins TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      anchor TEXT NOT NULL,
      page TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','resolved')),
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS review_sessions (
      token TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS projects_workspace_created ON projects(workspace_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS annotations_project_created ON annotations(project_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS auth_sessions_expires ON auth_sessions(expires_at);
  `);

  const getUserByEmail = database.prepare("SELECT * FROM users WHERE email = ?");
  const getUserById = database.prepare("SELECT * FROM users WHERE id = ?");
  const getWorkspaceForUser = database.prepare(`
    SELECT w.*, m.role FROM workspaces w
    JOIN workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1
  `);
  const insertUser = database.prepare("INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)");
  const insertWorkspace = database.prepare("INSERT INTO workspaces (id,name,slug,plan,trial_ends_at,created_at) VALUES (?,?,?,?,?,?)");
  const insertMember = database.prepare("INSERT INTO workspace_members (workspace_id,user_id,role,created_at) VALUES (?,?,?,?)");
  const insertAuthSession = database.prepare("INSERT INTO auth_sessions (token,user_id,expires_at,created_at) VALUES (?,?,?,?)");
  const getAuthSession = database.prepare(`
    SELECT s.*,u.email,u.name,u.created_at AS user_created_at
    FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?
  `);
  const deleteAuthSession = database.prepare("DELETE FROM auth_sessions WHERE token=?");
  const purgeAuthSessions = database.prepare("DELETE FROM auth_sessions WHERE expires_at < ?");
  const getProject = database.prepare("SELECT * FROM projects WHERE id=?");
  const getScopedProject = database.prepare("SELECT * FROM projects WHERE id=? AND workspace_id=?");
  const listProjects = database.prepare(`
    SELECT p.*, SUM(CASE WHEN a.status='open' THEN 1 ELSE 0 END) AS annotation_count
    FROM projects p LEFT JOIN annotations a ON a.project_id=p.id
    WHERE p.workspace_id=? GROUP BY p.id ORDER BY p.created_at DESC
  `);
  const insertProject = database.prepare("INSERT INTO projects (id,workspace_id,name,review_code_hash,allowed_origins,created_at) VALUES (?,?,?,?,?,?)");
  const updateProject = database.prepare("UPDATE projects SET name=?,review_code_hash=?,allowed_origins=? WHERE id=? AND workspace_id=?");
  const listAnnotations = database.prepare("SELECT * FROM annotations WHERE project_id=? ORDER BY created_at DESC");
  const listOpenAnnotations = database.prepare("SELECT * FROM annotations WHERE project_id=? AND status='open' ORDER BY created_at ASC");
  const getAnnotation = database.prepare("SELECT * FROM annotations WHERE id=?");
  const insertAnnotation = database.prepare("INSERT INTO annotations (id,project_id,comment,anchor,page,status,created_at) VALUES (?,?,?,?,?,'open',?)");
  const updateAnnotation = database.prepare("UPDATE annotations SET status=?,updated_at=? WHERE id=?");
  const updateAnnotationComment = database.prepare("UPDATE annotations SET comment=?,updated_at=? WHERE id=?");
  const deleteAnnotation = database.prepare("DELETE FROM annotations WHERE id=?");
  const insertReviewSession = database.prepare("INSERT OR REPLACE INTO review_sessions (token,project_id,expires_at) VALUES (?,?,?)");
  const getReviewSession = database.prepare("SELECT * FROM review_sessions WHERE token=?");
  const purgeReviewSessions = database.prepare("DELETE FROM review_sessions WHERE expires_at < ?");

  const createAccount = database.transaction(({ user, workspace }) => {
    insertUser.run(user.id,user.email,user.name,user.passwordHash,user.createdAt);
    insertWorkspace.run(workspace.id,workspace.name,workspace.slug,workspace.plan,workspace.trialEndsAt,workspace.createdAt);
    insertMember.run(workspace.id,user.id,"owner",user.createdAt);
  });

  return {
    findUserByEmail(email) {
      const row = getUserByEmail.get(email);
      return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
    },
    findUserById(id) { return toUser(getUserById.get(id)); },
    workspaceForUser(userId) { return toWorkspace(getWorkspaceForUser.get(userId)); },
    createAccount(input) {
      createAccount(input);
      return { user: this.findUserById(input.user.id), workspace: this.workspaceForUser(input.user.id) };
    },
    createAuthSession(token,userId,expiresAt,createdAt) {
      purgeAuthSessions.run(Date.now());
      insertAuthSession.run(token,userId,expiresAt,createdAt);
    },
    authSession(token) {
      purgeAuthSessions.run(Date.now());
      const row = getAuthSession.get(token);
      if (!row) return null;
      return {
        token: row.token, expiresAt: row.expires_at,
        user: { id: row.user_id, email: row.email, name: row.name, createdAt: row.user_created_at },
        workspace: this.workspaceForUser(row.user_id),
      };
    },
    deleteAuthSession(token) { deleteAuthSession.run(token); },
    findProject(id) { return toProject(getProject.get(id)); },
    findProjectForWorkspace(id,workspaceId) { return toProject(getScopedProject.get(id,workspaceId)); },
    listProjects(workspaceId) {
      return listProjects.all(workspaceId).map((row) => ({ ...toProject(row), annotationCount: Number(row.annotation_count || 0) }));
    },
    createProject(project) {
      insertProject.run(project.id,project.workspaceId,project.name,project.reviewCodeHash,JSON.stringify(project.allowedOrigins),project.createdAt);
      return this.findProject(project.id);
    },
    updateProject(project) {
      if (updateProject.run(project.name,project.reviewCodeHash,JSON.stringify(project.allowedOrigins),project.id,project.workspaceId).changes === 0) return null;
      return this.findProject(project.id);
    },
    listAnnotations(projectId,openOnly=false) {
      return (openOnly ? listOpenAnnotations.all(projectId) : listAnnotations.all(projectId)).map(toAnnotation);
    },
    findAnnotation(id) { return toAnnotation(getAnnotation.get(id)); },
    createAnnotation(annotation) {
      insertAnnotation.run(annotation.id,annotation.projectId,annotation.comment,JSON.stringify(annotation.anchor),JSON.stringify(annotation.page),annotation.createdAt);
      return annotation;
    },
    updateAnnotation(id,status,updatedAt) {
      if (updateAnnotation.run(status,updatedAt,id).changes === 0) return null;
      return this.findAnnotation(id);
    },
    updateAnnotationComment(id,comment,updatedAt) {
      if (updateAnnotationComment.run(comment,updatedAt,id).changes === 0) return null;
      return this.findAnnotation(id);
    },
    deleteAnnotation(id) { return deleteAnnotation.run(id).changes > 0; },
    createSession(token,session) {
      purgeReviewSessions.run(Date.now());
      insertReviewSession.run(token,session.projectId,session.expiresAt);
    },
    findSession(token) {
      purgeReviewSessions.run(Date.now());
      const row = getReviewSession.get(token);
      return row ? { projectId: row.project_id, expiresAt: row.expires_at } : null;
    },
  };
}
