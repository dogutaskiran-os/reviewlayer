import crypto from "node:crypto";
import express from "express";

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
}
function passwordMatches(password, encoded) {
  const [salt, expected] = String(encoded || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
function cookies(request) {
  return Object.fromEntries(String(request.get("cookie") || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const at = part.indexOf("="); return at < 0 ? [part,""] : [part.slice(0,at),decodeURIComponent(part.slice(at+1))];
  }));
}
function authCookie(request, token, maxAge=60*60*24*30) {
  const secure = request.secure || request.get("x-forwarded-proto") === "https";
  return `reviewlayer_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
function safeSlug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,32) || "workspace";
}
function originAllowed(project, origin) {
  return !origin || project.allowedOrigins.includes(origin);
}
function projectInput(body, workspaceId) {
  const id = String(body?.id || "").trim().toLowerCase();
  const name = String(body?.name || "").trim();
  const reviewCode = String(body?.reviewCode || "");
  const candidateOrigins = Array.isArray(body?.allowedOrigins) ? body.allowedOrigins : [];
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(id)) return { error: "Project IDs use lowercase letters, numbers, and hyphens." };
  if (name.length < 2 || name.length > 120) return { error: "Project names need between 2 and 120 characters." };
  if (reviewCode.length < 8 || reviewCode.length > 120) return { error: "Review codes need between 8 and 120 characters." };
  const allowedOrigins = [...new Set(candidateOrigins.map((origin) => String(origin).trim()).filter(Boolean))];
  if (!allowedOrigins.length) return { error: "Add at least one client site origin." };
  for (const origin of allowedOrigins) {
    try {
      const parsed = new URL(origin);
      if (!["http:","https:"].includes(parsed.protocol) || parsed.origin !== origin) throw new Error();
    } catch { return { error: `Use a full origin such as https://preview.example.com. Invalid origin: ${origin}` }; }
  }
  return { project: { id, workspaceId, name, reviewCodeHash: hash(reviewCode), allowedOrigins, createdAt: new Date().toISOString() } };
}
function projectUpdateInput(body, project) {
  const name = String(body?.name || "").trim();
  const reviewCode = String(body?.reviewCode || "");
  const candidateOrigins = Array.isArray(body?.allowedOrigins) ? body.allowedOrigins : [];
  if (name.length < 2 || name.length > 120) return { error: "Project names need between 2 and 120 characters." };
  if (reviewCode && (reviewCode.length < 8 || reviewCode.length > 120)) return { error: "New review codes need between 8 and 120 characters." };
  const allowedOrigins = [...new Set(candidateOrigins.map((origin) => String(origin).trim()).filter(Boolean))];
  if (!allowedOrigins.length) return { error: "Add at least one client site origin." };
  for (const origin of allowedOrigins) {
    try {
      const parsed = new URL(origin);
      if (!["http:","https:"].includes(parsed.protocol) || parsed.origin !== origin) throw new Error();
    } catch { return { error: `Use a full origin such as https://preview.example.com. Invalid origin: ${origin}` }; }
  }
  return { project: { ...project, name, allowedOrigins, ...(reviewCode ? { reviewCodeHash: hash(reviewCode) } : {}) } };
}

export function createApiApp({ store }) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", async (request, response, next) => {
    try {
      const origin = request.get("origin");
      const reviewId = request.params.reviewId || request.path.split("/")[2];
      const project = reviewId ? store.findProject(reviewId) : undefined;
      if (origin && project && originAllowed(project, origin)) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      }
      if (request.method === "OPTIONS") return response.status(204).end();
      next();
    } catch (error) { next(error); }
  });

  async function requireUser(request, response, next) {
    const token = cookies(request).reviewlayer_session;
    const auth = token ? store.authSession(token) : null;
    if (!auth?.user || !auth?.workspace) return response.status(401).json({ error: "Sign in required." });
    request.auth = auth;
    next();
  }

  app.post("/api/auth/signup", (request, response) => {
    const name = String(request.body?.name || "").trim();
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const workspaceName = String(request.body?.workspaceName || "").trim() || `${name}'s workspace`;
    if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Enter your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: "Enter a valid email." });
    if (password.length < 8 || password.length > 200) return response.status(400).json({ error: "Use at least 8 characters for your password." });
    if (store.findUserByEmail(email)) return response.status(409).json({ error: "An account already exists for this email." });
    const now = new Date();
    const user = { id: crypto.randomUUID(), name, email, passwordHash: passwordHash(password), createdAt: now.toISOString() };
    const workspace = {
      id: crypto.randomUUID(), name: workspaceName,
      slug: `${safeSlug(workspaceName)}-${crypto.randomBytes(3).toString("hex")}`,
      plan: "trial", trialEndsAt: new Date(now.getTime()+14*86400000).toISOString(), createdAt: now.toISOString()
    };
    const account = store.createAccount({ user, workspace });
    const token = crypto.randomBytes(32).toString("hex");
    store.createAuthSession(token,user.id,Date.now()+30*86400000,now.toISOString());
    response.setHeader("Set-Cookie", authCookie(request, token));
    response.status(201).json(account);
  });

  app.post("/api/auth/login", (request, response) => {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    const user = store.findUserByEmail(email);
    if (!user || !passwordMatches(password,user.passwordHash)) return response.status(401).json({ error: "Email or password is incorrect." });
    const token = crypto.randomBytes(32).toString("hex");
    store.createAuthSession(token,user.id,Date.now()+30*86400000,new Date().toISOString());
    response.setHeader("Set-Cookie", authCookie(request, token));
    response.json({ user: { id:user.id,email:user.email,name:user.name,createdAt:user.createdAt }, workspace: store.workspaceForUser(user.id) });
  });

  app.post("/api/auth/logout", (request, response) => {
    const token = cookies(request).reviewlayer_session;
    if (token) store.deleteAuthSession(token);
    response.setHeader("Set-Cookie", authCookie(request, "", 0));
    response.status(204).end();
  });

  app.get("/api/me", requireUser, (request, response) => response.json(request.auth));

  app.get("/api/projects", requireUser, (request, response) => {
    const projects = store.listProjects(request.auth.workspace.id);
    response.json(projects.map(({ reviewCodeHash, workspaceId, ...project }) => project));
  });

  app.post("/api/projects", requireUser, (request, response) => {
    const result = projectInput(request.body, request.auth.workspace.id);
    if (result.error) return response.status(400).json({ error: result.error });
    if (store.findProject(result.project.id)) return response.status(409).json({ error: "That project ID already exists." });
    const project = store.createProject(result.project);
    const { reviewCodeHash, workspaceId, ...safeProject } = project;
    response.status(201).json(safeProject);
  });

  app.patch("/api/projects/:projectId", requireUser, (request, response) => {
    const currentProject = store.findProjectForWorkspace(request.params.projectId,request.auth.workspace.id);
    if (!currentProject) return response.status(404).json({ error: "Project not found." });
    const result = projectUpdateInput(request.body,currentProject);
    if (result.error) return response.status(400).json({ error: result.error });
    const project = store.updateProject(result.project);
    const { reviewCodeHash, workspaceId, ...safeProject } = project;
    response.json(safeProject);
  });

  app.post("/api/projects/:projectId/preview-session", requireUser, (request, response) => {
    const project = store.findProjectForWorkspace(request.params.projectId,request.auth.workspace.id);
    if (!project) return response.status(404).json({ error: "Project not found." });
    const token = crypto.randomUUID();
    const expiresAt = Date.now()+12*3600000;
    store.createSession(token,{projectId:project.id,expiresAt});
    response.json({token,expiresAt:new Date(expiresAt).toISOString()});
  });

  app.post("/api/reviews/:reviewId/unlock", (request, response) => {
    const project = store.findProject(request.params.reviewId);
    const origin = request.get("origin");
    if (!project || !originAllowed(project,origin)) return response.status(404).json({ error: "Review not found." });
    const codeHash = hash(String(request.body?.code || ""));
    if (codeHash.length !== project.reviewCodeHash.length || !crypto.timingSafeEqual(Buffer.from(codeHash),Buffer.from(project.reviewCodeHash))) {
      return response.status(401).json({ error: "That review code is not right." });
    }
    const token = crypto.randomUUID();
    const expiresAt = Date.now()+12*3600000;
    store.createSession(token,{projectId:project.id,expiresAt});
    response.json({token,expiresAt:new Date(expiresAt).toISOString()});
  });

  function sessionFor(request,projectId) {
    const token = request.get("authorization")?.replace("Bearer ","");
    const session = token ? store.findSession(token) : null;
    return session && session.projectId===projectId && session.expiresAt>=Date.now() ? session : null;
  }

  app.get("/api/reviews/:reviewId/annotations", (request,response) => {
    const project=store.findProject(request.params.reviewId);
    if(!project || !sessionFor(request,project.id)) return response.status(401).json({error:"Review session required."});
    response.json(store.listAnnotations(project.id,true));
  });
  app.post("/api/reviews/:reviewId/annotations", (request,response) => {
    const project=store.findProject(request.params.reviewId);
    if(!project || !sessionFor(request,project.id)) return response.status(401).json({error:"Review session required."});
    const body=request.body||{};
    if(typeof body.comment!=="string" || body.comment.trim().length<2 || body.comment.length>1200) return response.status(400).json({error:"Comments need between 2 and 1200 characters."});
    if(!body.anchor?.selector || !body.page?.url) return response.status(400).json({error:"An annotation target is required."});
    const annotation={id:crypto.randomUUID(),projectId:project.id,comment:body.comment.trim(),anchor:body.anchor,page:body.page,status:"open",createdAt:new Date().toISOString()};
    store.createAnnotation(annotation); response.status(201).json(annotation);
  });
  app.patch("/api/reviews/:reviewId/annotations/:annotationId", (request,response) => {
    const project=store.findProject(request.params.reviewId);
    if(!project || !sessionFor(request,project.id)) return response.status(401).json({error:"Review session required."});
    const current=store.findAnnotation(request.params.annotationId);
    if(!current || current.projectId!==project.id) return response.status(404).json({error:"Feedback not found."});
    const comment=String(request.body?.comment||"").trim();
    if(comment.length<2 || comment.length>1200) return response.status(400).json({error:"Comments need between 2 and 1200 characters."});
    response.json(store.updateAnnotationComment(current.id,comment,new Date().toISOString()));
  });
  app.delete("/api/reviews/:reviewId/annotations/:annotationId", (request,response) => {
    const project=store.findProject(request.params.reviewId);
    if(!project || !sessionFor(request,project.id)) return response.status(401).json({error:"Review session required."});
    const current=store.findAnnotation(request.params.annotationId);
    if(!current || current.projectId!==project.id) return response.status(404).json({error:"Feedback not found."});
    store.deleteAnnotation(current.id); response.status(204).end();
  });

  app.get("/api/projects/:projectId/annotations", requireUser, (request,response) => {
    const project=store.findProjectForWorkspace(request.params.projectId,request.auth.workspace.id);
    if(!project) return response.status(404).json({error:"Project not found."});
    response.json(store.listAnnotations(project.id));
  });
  app.patch("/api/annotations/:annotationId", requireUser, (request,response) => {
    if(!["open","resolved"].includes(request.body?.status)) return response.status(400).json({error:"Unknown status."});
    const annotation=store.findAnnotation(request.params.annotationId);
    const project=annotation && store.findProjectForWorkspace(annotation.projectId,request.auth.workspace.id);
    if(!annotation || !project) return response.status(404).json({error:"Annotation not found."});
    response.json(store.updateAnnotation(annotation.id,request.body.status,new Date().toISOString()));
  });
  app.delete("/api/annotations/:annotationId", requireUser, (request,response) => {
    const annotation=store.findAnnotation(request.params.annotationId);
    const project=annotation && store.findProjectForWorkspace(annotation.projectId,request.auth.workspace.id);
    if(!annotation || !project) return response.status(404).json({error:"Annotation not found."});
    store.deleteAnnotation(annotation.id); response.status(204).end();
  });

  app.use((error,_request,response,_next) => {
    console.error(error);
    response.status(500).json({error:"ReviewLayer could not process that request."});
  });
  return app;
}
