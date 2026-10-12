// Production installs the Temporal polyfill in db.provider.ts; unit tests often mock that module,
// so install it here for every test file too.
import 'temporal-polyfill/full/global';
