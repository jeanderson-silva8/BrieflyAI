const { ZodError } = require('zod');

/**
 * Middleware factory de validação Zod.
 * Valida body, params e/ou query contra schemas fornecidos.
 * Rejeita com 400 + detalhes legíveis antes de chegar no controller.
 *
 * @param {{ body?: ZodSchema, params?: ZodSchema, query?: ZodSchema }} schemas
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        // Express 5: req.query é getter — anexamos o resultado validado em req.validatedQuery
        req.validatedQuery = schemas.query.parse(req.query);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues || err.errors || [];
        const errors = issues.map(e => ({
          campo: (e.path || []).join('.') || 'desconhecido',
          mensagem: e.message
        }));
        return res.status(400).json({
          error: 'Dados de entrada inválidos',
          detalhes: errors
        });
      }
      next(err);
    }
  };
}

module.exports = validate;
