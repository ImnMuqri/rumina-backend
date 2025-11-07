export function generateToken(app, user) {
  return app.jwt.sign({ id: user.id, email: user.email });
}
