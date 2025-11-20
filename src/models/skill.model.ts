import mongoose, { Document, Schema } from 'mongoose';

interface ISkill extends Document {
  name: string;
  displayName: string;
}

const SkillSchema = new Schema({
  name: { type: String, required: true, unique: true, lowercase: true }, 
  displayName: { type: String, required: true } // For frontend
});


const Skill = mongoose.model<ISkill>('Skill', SkillSchema);
export { Skill };
export type { ISkill };
