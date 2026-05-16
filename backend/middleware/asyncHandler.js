/**
 * Wrapper para handlers async em Express.
 * Captura erros de funções async e os passa para next(),
 * exercitando o error handler global automaticamente.
 *
 * Uso: router.get('/rota', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
