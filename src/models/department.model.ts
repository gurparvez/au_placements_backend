import mongoose, { Document, Schema } from 'mongoose';

/**
 * A university department — institutional reference data, managed by admin.
 *
 * Students, recruiters (eligibility), and every dashboard grouping key off the
 * department NAME, so this collection exists to constrain those to one canonical
 * spelling. Without it "CSE", "Computer Science", and "comp sci" fragment every
 * report. Deliberately name-keyed (not id-referenced from Student) so existing
 * analytics that group by the string keep working unchanged.
 */
interface IDepartment extends Document {
  name: string;
  code?: string; // short label, e.g. "CSE"
  active: boolean; // soft-disable without deleting historical data
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const Department = mongoose.model<IDepartment>('Department', DepartmentSchema);

export { Department };
export type { IDepartment };
