# 登录、注册与角色认证接口文档

Base URL：`http://127.0.0.1:3001/api/auth`。接口使用服务端 Session：登录成功后服务端通过 `Set-Cookie` 写入 HttpOnly Cookie，响应体**不会**返回访问令牌。浏览器调用必须携带 `credentials: 'include'`。

## 通用约定

- 请求体为 `application/json`，最大 16 KB。
- 用户名会去除首尾空格并转换为小写；长度 3–32，只能使用字母、数字、`.`、`_`、`-`。
- 密码长度为 10–128 个字符。
- 角色为 `PATIENT`、`DOCTOR`、`ADMIN`。患者仅能创建和读取自己的训练会话；医生仅能读取已关联患者的摘要；管理员管理医生审核和医患关联。
- 所有响应均有 `Cache-Control: no-store`。未知用户、错误密码和已禁用账户均返回相同的 401 响应，避免枚举用户。
- 生产环境 Cookie 名为 `__Host-aisteriod_session`，开发环境为 `aisteriod_session`；属性为 `HttpOnly`、`SameSite=Lax`、`Path=/`，生产环境额外启用 `Secure`。默认有效期为 7 天。

## POST `/login`

登录并创建可撤销的服务端 Session。允许来源受 `ALLOWED_ORIGINS` 限制；默认按“IP + 用户名”在 15 分钟内最多 10 次尝试。

请求：

```json
{ "username": "patient.one", "password": "a-safe-password" }
```

成功 `200`：

```json
{
  "user": { "id": "...", "username": "patient.one", "displayName": "患者一", "role": "PATIENT", "status": "ACTIVE", "lastLoginAt": "...", "createdAt": "...", "updatedAt": "..." },
  "session": { "expiresAt": "2026-09-01T00:00:00.000Z" }
}
```

可能错误：`400 VALIDATION_ERROR`（`details` 含字段错误）、`401 INVALID_CREDENTIALS`、`403 ACCOUNT_PENDING_APPROVAL`（密码正确但医生尚未审核）、`403 ORIGIN_NOT_ALLOWED`、`429 TOO_MANY_LOGIN_ATTEMPTS`。

## POST `/register`

注册患者或医生。请求字段与登录规则一致，并新增 `displayName`（1–50 字符）和可选的 `role`；`role` 只能是 `PATIENT`（默认）或 `DOCTOR`。请求必须来自允许的 `Origin`，默认每个 IP 在 15 分钟内最多 5 次注册。

```json
{
  "username": "doctor.one",
  "password": "a-safe-long-password",
  "displayName": "李医生",
  "role": "DOCTOR"
}
```

患者成功时返回 `201`、设置 Session Cookie，并返回：

```json
{
  "user": { "role": "PATIENT", "status": "ACTIVE" },
  "session": { "expiresAt": "..." },
  "registration": { "requiresApproval": false }
}
```

医生成功时返回 `202`，不设置 Cookie，并返回 `user.status: "PENDING"` 和 `registration.requiresApproval: true`。管理员审核通过前登录返回 `403 ACCOUNT_PENDING_APPROVAL`。用户名重复返回 `409 USERNAME_TAKEN`；传入 `ADMIN` 或额外字段会返回 `400 VALIDATION_ERROR`。

## GET `/me`

返回当前登录用户。需要有效 Session Cookie。

成功 `200`：`{ "user": { ... } }`。未登录、会话过期/撤销或账户已禁用时返回 `401 AUTHENTICATION_REQUIRED`。

## POST `/logout`

撤销当前 Cookie 对应的 Session 并清除 Cookie；可重复调用。成功或不存在 Session 均返回 `204 No Content`。该写操作同样需要允许的 `Origin`，否则返回 `403 ORIGIN_NOT_ALLOWED`。

## POST `/logout-all`

需要有效 Session。撤销当前用户的全部未撤销 Session，并清除本次请求的 Cookie。成功返回 `204 No Content`；未登录返回 `401 AUTHENTICATION_REQUIRED`；来源不允许返回 `403 ORIGIN_NOT_ALLOWED`。

## 管理员审核医生

以下接口都需要已登录的 `ADMIN` 账号；其他角色返回 `403 ROLE_REQUIRED`。

- `GET /admin/doctor-registrations`：返回所有状态为 `PENDING` 的医生账号，格式为 `{ "users": [...] }`。
- `POST /admin/doctor-registrations/:userId/approve`：审核并激活医生，返回 `{ "user": { "role": "DOCTOR", "status": "ACTIVE" } }`。这是写操作，必须带允许的 `Origin`。

## 前端调用示例

```js
await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
})
```

配置项：`AUTH_SESSION_TTL_DAYS`、`AUTH_LOGIN_WINDOW_MINUTES`、`AUTH_LOGIN_MAX_ATTEMPTS`、`AUTH_REGISTER_MAX_ATTEMPTS` 可覆盖上述默认值；跨域部署还需将前端准确地址加入 `ALLOWED_ORIGINS`。
