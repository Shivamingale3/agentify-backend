import z from 'zod';

const deviceHeadersSchema = z
  .object({
    'x-client-name': z.string().optional(),
    'x-client-type': z.string().optional(),
  })
  .loose();

export default deviceHeadersSchema;
