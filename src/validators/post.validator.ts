import { z } from 'zod';
import { REACTION_TYPES } from '../models/reaction.model';

const linkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
});

export const createPostSchema = z.object({
  content: z.string().min(1, 'Post content is required').max(5000),
  links: z.array(linkSchema).max(5).optional(),
  mentions: z.array(z.string()).max(20).optional(),
});

export const updatePostSchema = z
  .object({
    content: z.string().min(1).max(5000).optional(),
    links: z.array(linkSchema).max(5).optional(),
    mentions: z.array(z.string()).max(20).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update.' });

export const sharePostSchema = z.object({
  quote: z.string().max(2000).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment is required').max(2000),
  parent: z.string().optional(),
  mentions: z.array(z.string()).max(20).optional(),
});

export const reactSchema = z.object({
  type: z.enum(REACTION_TYPES),
});

export const archivePostSchema = z.object({
  archived: z.boolean(),
});
