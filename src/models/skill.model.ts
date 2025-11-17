import mongoose, { Schema, Document } from 'mongoose'

interface ISkill extends Document {
  name: string
}

const SkillSchema = new Schema<ISkill>(
  {
    name: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
)

const Skill = mongoose.model<ISkill>('Skill', SkillSchema)
export { Skill }
export type { ISkill }
