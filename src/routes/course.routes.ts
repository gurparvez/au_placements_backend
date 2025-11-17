import { Router } from 'express'
import { addCourse, searchCourses } from '../controllers/course.controller'

const router = Router()

router.post('/', addCourse)
router.get('/search', searchCourses)

export default router
