import mongoose from 'mongoose';
import { CONFIG } from './environment';
import { logger } from '../utils/logger';

/**
 * Global Mongoose plugin that times every query/aggregate and logs the ones that
 * exceed SLOW_QUERY_MS. Registering it BEFORE any model compiles (i.e. before the
 * first model import) makes it apply to every schema. Call from connectDB().
 */
export function registerQueryTiming() {
  const threshold = CONFIG.observability.slowQueryMs;
  const ops = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
    'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
    'countDocuments', 'distinct', 'aggregate',
  ];

  mongoose.plugin((schema: any) => {
    ops.forEach((op) => {
      schema.pre(op, function (this: any) {
        this.__start = process.hrtime.bigint();
      });
      schema.post(op, function (this: any) {
        if (!this.__start) return;
        const ms = Math.round(Number(process.hrtime.bigint() - this.__start) / 1e6);
        if (ms >= threshold) {
          const model = this.model?.modelName || this.mongooseCollection?.name || 'unknown';
          logger.warn({ model, op, ms }, 'slow query');
        }
      });
    });
  });
}
