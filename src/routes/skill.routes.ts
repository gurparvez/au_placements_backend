import { Router } from 'express'
import { addSkill, searchSkills } from '../controllers/skill.controller'

const router = Router()

router.post('/', addSkill)
router.get('/search', searchSkills)

export default router
