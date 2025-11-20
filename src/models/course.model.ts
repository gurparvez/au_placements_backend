import mongoose, { Document, Schema } from 'mongoose';

interface ICourse extends Document {
  name: string;
  category: 'high_school' | 'ug' | 'pg' | 'diploma' | 'other';
}

const CourseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ['high_school', 'ug', 'pg', 'diploma', 'other'],
      required: true,
    },
  },
  { timestamps: true }
);

const Course = mongoose.model<ICourse>('Course', CourseSchema);
export { Course };
export type { ICourse };
