import { Request, Response } from 'express';
import { PostService } from '../services/post.service';
import { CommentService } from '../services/comment.service';
import { ReactionService } from '../services/reaction.service';
import { asyncHandler } from '../utils/handler';
import { getPagination } from '../utils/paginate';
import { uploadToCloudinary } from '../utils/uploadToCloudinary';

const postService = new PostService();
const commentService = new CommentService();
const reactionService = new ReactionService();

const viewerId = (res: Response) => (res.locals.user ? String(res.locals.user._id) : undefined);

/* -------------------------------- posts -------------------------------- */

export const listFeed = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await postService.feed(page, limit, skip, viewerId(res));
  res.json({ success: true, data: result.posts, pagination: result.pagination });
});

export const getPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await postService.getById(String(req.params.id), viewerId(res));
  res.json({ success: true, data: post });
});

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  // Uploaded images (multipart) → Cloudinary → media[]
  const files = (req.files as Express.Multer.File[]) || [];
  const media: { type: 'image'; url: string }[] = [];
  for (const f of files) {
    const uploaded: any = await uploadToCloudinary(f.buffer, 'posts');
    if (uploaded?.secure_url) media.push({ type: 'image', url: uploaded.secure_url });
  }

  // mentions arrive as a JSON string over multipart, or an array over JSON.
  let mentions = req.body.mentions;
  if (typeof mentions === 'string') {
    try { mentions = JSON.parse(mentions); } catch { mentions = []; }
  }

  const post = await postService.create(String(res.locals.user._id), {
    content: req.body.content ?? '',
    mentions: Array.isArray(mentions) ? mentions : [],
    media,
  });
  res.status(201).json({ success: true, message: 'Posted', data: post });
});

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await postService.update(String(req.params.id), res.locals.user, req.body);
  res.json({ success: true, message: 'Post updated', data: post });
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const result = await postService.remove(String(req.params.id), res.locals.user);
  res.json({ success: true, message: 'Post deleted', data: result });
});

export const archivePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await postService.setArchived(String(req.params.id), res.locals.user, req.body.archived === true);
  res.json({ success: true, message: post.archived ? 'Post archived' : 'Post restored', data: post });
});

export const sharePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await postService.share(String(req.params.id), String(res.locals.user._id), req.body?.quote);
  res.status(201).json({ success: true, message: 'Reposted', data: post });
});

export const reactToPost = asyncHandler(async (req: Request, res: Response) => {
  const result = await reactionService.toggle('post', String(req.params.id), String(res.locals.user._id), req.body.type);
  res.json({ success: true, data: result });
});

/* ------------------------------ comments ------------------------------ */

export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const comments = await commentService.list(String(req.params.id), viewerId(res));
  res.json({ success: true, data: comments });
});

export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await commentService.create(String(req.params.id), String(res.locals.user._id), req.body);
  res.status(201).json({ success: true, message: 'Comment added', data: comment });
});
