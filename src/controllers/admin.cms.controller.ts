import { body } from 'express-validator';
import { adminAsyncHandler, authenticateAdmin } from '../middleware/adminAuth';
import { validate, validateBody } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── FAQs ───────────────────────────────────────────────────
export const listFaqs = [authenticateAdmin, adminAsyncHandler(async (_req, res) => {
  const faqs = await prisma.faq.findMany({ orderBy: { created_at: 'desc' } });
  return sendSuccess(res, 'FAQs fetched', serialize(faqs));
})];

export const createFaq = [
  authenticateAdmin,
  validateBody(['question', 'answer'], [
    body('question').notEmpty().withMessage('question is required'),
    body('answer').notEmpty().withMessage('answer is required'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const faq = await prisma.faq.create({ data: { question: req.body.question, answer: req.body.answer } });
    return sendSuccess(res, 'FAQ created', serialize(faq), 201);
  }),
];

export const updateFaq = [
  authenticateAdmin,
  validateBody(['id', 'question', 'answer'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('question').optional().notEmpty().withMessage('question cannot be empty'),
    body('answer').optional().notEmpty().withMessage('answer cannot be empty'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const faq = await prisma.faq.update({
      where: { id: BigInt(req.body.id) },
      data: { question: req.body.question, answer: req.body.answer },
    });
    return sendSuccess(res, 'FAQ updated', serialize(faq));
  }),
];

export const deleteFaq = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.faq.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'FAQ deleted');
  }),
];

// ─── Success Stories ────────────────────────────────────────
export const listStories = [authenticateAdmin, adminAsyncHandler(async (_req, res) => {
  const stories = await prisma.story.findMany({ orderBy: { created_at: 'desc' } });
  return sendSuccess(res, 'Stories fetched', serialize(stories));
})];

export const createStory = [
  authenticateAdmin,
  validateBody(['title', 'client_name', 'review', 'rating', 'image'], [
    body('title').optional().isString().trim(),
    body('client_name').optional().isString().trim(),
    body('review').optional().isString(),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('rating must be 1-5'),
    body('image').optional().isString().trim(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const story = await prisma.story.create({ data: req.body });
    return sendSuccess(res, 'Story created', serialize(story), 201);
  }),
];

export const updateStory = [
  authenticateAdmin,
  validateBody(['id', 'title', 'client_name', 'review', 'rating', 'image'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('title').optional().isString().trim(),
    body('client_name').optional().isString().trim(),
    body('review').optional().isString(),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('rating must be 1-5'),
    body('image').optional().isString().trim(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const { id, ...data } = req.body;
    const story = await prisma.story.update({ where: { id: BigInt(id) }, data });
    return sendSuccess(res, 'Story updated', serialize(story));
  }),
];

export const deleteStory = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.story.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'Story deleted');
  }),
];

// ─── Blog Categories ────────────────────────────────────────
export const listBlogCategories = [authenticateAdmin, adminAsyncHandler(async (_req, res) => {
  const categories = await prisma.blogCategory.findMany({ orderBy: { created_at: 'desc' } });
  return sendSuccess(res, 'Blog categories fetched', serialize(categories));
})];

export const createBlogCategory = [
  authenticateAdmin,
  validateBody(['category_name', 'image'], [
    body('category_name').notEmpty().withMessage('category_name is required'),
    body('image').optional().isString().trim(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const category = await prisma.blogCategory.create({
      data: {
        category_name: req.body.category_name,
        slug: slugify(req.body.category_name),
        image: req.body.image,
      },
    });
    return sendSuccess(res, 'Category created', serialize(category), 201);
  }),
];

export const updateBlogCategory = [
  authenticateAdmin,
  validateBody(['id', 'category_name', 'image'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('category_name').optional().notEmpty().withMessage('category_name cannot be empty'),
    body('image').optional().isString().trim(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const category = await prisma.blogCategory.update({
      where: { id: BigInt(req.body.id) },
      data: {
        category_name: req.body.category_name,
        slug: req.body.category_name ? slugify(req.body.category_name) : undefined,
        image: req.body.image,
      },
    });
    return sendSuccess(res, 'Category updated', serialize(category));
  }),
];

export const deleteBlogCategory = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.blogCategory.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'Category deleted');
  }),
];

// ─── Blogs ──────────────────────────────────────────────────
export const listBlogs = [authenticateAdmin, adminAsyncHandler(async (_req, res) => {
  const blogs = await prisma.blog.findMany({
    include: { category: true },
    orderBy: { created_at: 'desc' },
  });
  return sendSuccess(res, 'Blogs fetched', serialize(blogs));
})];

export const createBlog = [
  authenticateAdmin,
  validateBody(['title', 'content', 'blog_category_id', 'tags', 'image'], [
    body('title').notEmpty().withMessage('title is required'),
    body('content').notEmpty().withMessage('content is required'),
    body('blog_category_id').isInt({ min: 1 }).withMessage('blog_category_id must be a positive integer'),
    body('tags').optional().isString(),
    body('image').optional().isString().trim(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const blog = await prisma.blog.create({
      data: {
        title: req.body.title,
        slug: slugify(req.body.title),
        content: req.body.content,
        tags: req.body.tags,
        image: req.body.image,
        blog_category_id: BigInt(req.body.blog_category_id),
      },
    });
    return sendSuccess(res, 'Blog created', serialize(blog), 201);
  }),
];

export const updateBlog = [
  authenticateAdmin,
  validateBody(['id', 'title', 'content', 'blog_category_id', 'tags', 'image'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('title').optional().notEmpty().withMessage('title cannot be empty'),
    body('content').optional().notEmpty().withMessage('content cannot be empty'),
    body('blog_category_id').optional().isInt({ min: 1 }).withMessage('blog_category_id must be a positive integer'),
    body('tags').optional().isString(),
    body('image').optional().isString().trim(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const blog = await prisma.blog.update({
      where: { id: BigInt(req.body.id) },
      data: {
        title: req.body.title,
        slug: req.body.title ? slugify(req.body.title) : undefined,
        content: req.body.content,
        tags: req.body.tags,
        image: req.body.image,
        blog_category_id: req.body.blog_category_id ? BigInt(req.body.blog_category_id) : undefined,
      },
    });
    return sendSuccess(res, 'Blog updated', serialize(blog));
  }),
];

export const deleteBlog = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.blog.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'Blog deleted');
  }),
];

// ─── Policies (privacy, terms, refund) ─────────────────────
export const getPolicy = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const type = routeParam(req.params.type);
    const policy = await prisma.privacyPolicy.findFirst({ where: { type } });
    return sendSuccess(res, 'Policy fetched', serialize(policy));
  }),
];

export const upsertPolicy = [
  authenticateAdmin,
  validateBody(['type', 'title', 'content'], [
    body('type').isIn(['privacy', 'terms', 'refund']).withMessage('type must be privacy, terms, or refund'),
    body('title').notEmpty().withMessage('title is required'),
    body('content').optional().isString(),
  ]),
  adminAsyncHandler(async (req, res) => {
    const existing = await prisma.privacyPolicy.findFirst({ where: { type: req.body.type } });
    const policy = existing
      ? await prisma.privacyPolicy.update({
          where: { id: existing.id },
          data: { title: req.body.title, content: req.body.content, type: req.body.type },
        })
      : await prisma.privacyPolicy.create({
          data: { title: req.body.title, content: req.body.content, type: req.body.type },
        });
    return sendSuccess(res, 'Policy saved', serialize(policy));
  }),
];

// ─── Homepage counters ──────────────────────────────────────
export const getCounters = [authenticateAdmin, adminAsyncHandler(async (_req, res) => {
  const counter = await prisma.counter.findFirst({ orderBy: { id: 'desc' } });
  return sendSuccess(res, 'Counters fetched', serialize(counter));
})];

export const updateCounters = [
  authenticateAdmin,
  validateBody(['no_of_members', 'stories', 'total_cities'], [
    body('no_of_members').optional().isInt({ min: 0 }).withMessage('no_of_members must be a non-negative integer'),
    body('stories').optional().isInt({ min: 0 }).withMessage('stories must be a non-negative integer'),
    body('total_cities').optional().isInt({ min: 0 }).withMessage('total_cities must be a non-negative integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const existing = await prisma.counter.findFirst({ orderBy: { id: 'desc' } });
    const counter = existing
      ? await prisma.counter.update({
          where: { id: existing.id },
          data: {
            no_of_members: req.body.no_of_members,
            stories: req.body.stories,
            total_cities: req.body.total_cities,
          },
        })
      : await prisma.counter.create({ data: req.body });
    return sendSuccess(res, 'Counters updated', serialize(counter));
  }),
];

// ─── Contact enquiries & callbacks ──────────────────────────
export const resolveContactEnquiry = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const enquiry = await prisma.contactEnquiry.update({
      where: { id: BigInt(routeParam(req.params.id)) },
      data: { status: 'resolved' },
    });
    return sendSuccess(res, 'Enquiry resolved', serialize(enquiry));
  }),
];

export const deleteContactEnquiry = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.contactEnquiry.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'Enquiry deleted');
  }),
];

export const resolveCallback = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const record = await prisma.requestACall.update({
      where: { id: BigInt(routeParam(req.params.id)) },
      data: { status: 'resolved' },
    });
    return sendSuccess(res, 'Callback resolved', serialize(record));
  }),
];

export const deleteCallback = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.requestACall.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'Callback deleted');
  }),
];

// ─── Admin messages to users ────────────────────────────────
export const listAdminMessages = [authenticateAdmin, adminAsyncHandler(async (_req, res) => {
  const messages = await prisma.adminMessage.findMany({ orderBy: { created_at: 'desc' }, take: 100 });
  return sendSuccess(res, 'Admin messages fetched', serialize(messages));
})];

export const sendAdminMessage = [
  authenticateAdmin,
  validateBody(['receiver_id', 'message'], [
    body('receiver_id').isInt({ min: 1 }).withMessage('receiver_id must be a positive integer'),
    body('message').notEmpty().trim().withMessage('message is required'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const adminId = (req as { adminId?: bigint }).adminId;
    if (!adminId) throw AppError.unauthorized('Admin not authenticated');
    const msg = await prisma.adminMessage.create({
      data: {
        sender_id: adminId,
        receiver_id: BigInt(req.body.receiver_id),
        message: req.body.message,
      },
    });
    return sendSuccess(res, 'Message sent', serialize(msg), 201);
  }),
];

export const deleteAdminMessage = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    await prisma.adminMessage.delete({ where: { id: BigInt(routeParam(req.params.id)) } });
    return sendSuccess(res, 'Message deleted');
  }),
];

// ─── User chat audit ────────────────────────────────────────
export const listUserChats = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const messages = await prisma.message.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        sender: { select: { member_id: true, name: true } },
        receiver: { select: { member_id: true, name: true } },
      },
    });
    return sendSuccess(res, 'User chats fetched', serialize(messages));
  }),
];

export const getChatThread = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const userA = BigInt(routeParam(req.params.userId));
    const userB = BigInt(routeParam(req.params.receiverId));
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { sender_id: userA, receiver_id: userB },
          { sender_id: userB, receiver_id: userA },
        ],
      },
      orderBy: { created_at: 'asc' },
    });
    return sendSuccess(res, 'Chat thread fetched', serialize(messages));
  }),
];
