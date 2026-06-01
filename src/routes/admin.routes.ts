import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import * as plans from '../controllers/admin.plans.controller';
import * as cms from '../controllers/admin.cms.controller';
import * as castes from '../controllers/admin.castes.controller';
import * as locations from '../controllers/admin.locations.controller';

const router = Router();

// Auth & dashboard
router.post('/auth/login', admin.adminLogin);
router.post('/auth/logout', admin.adminLogout);
router.get('/dashboard', admin.adminDashboard);
router.get('/sales', admin.adminSales);

// Members
router.get('/members', admin.listMembers);
router.get('/members/:memberId', admin.getMember);
router.patch('/members/:userId', admin.updateMember);
router.delete('/members/:userId', admin.softDeleteMember);
router.post('/members/:userId/restore', admin.restoreMember);

// Trust badges
router.get('/trust-badges/pending', admin.listPendingTrustBadges);
router.patch('/trust-badges', admin.updateTrustBadge);

// Subscriptions
router.get('/subscriptions', admin.listSubscriptions);
router.post('/subscriptions/assign', plans.assignSubscription);
router.post('/subscriptions/:subscriptionId/cancel', plans.cancelSubscription);

// Plans
router.get('/plans', plans.listPlans);
router.get('/plans/:slug', plans.getPlan);
router.post('/plans', plans.createPlan);
router.patch('/plans', plans.updatePlan);
router.delete('/plans/:planId', plans.deletePlan);
router.patch('/plans/toggle-status', plans.togglePlanStatus);

// Locations
router.get('/locations/countries', locations.listCountries);
router.post('/locations/countries', locations.createCountry);
router.patch('/locations/countries', locations.updateCountry);
router.delete('/locations/countries/:id', locations.deleteCountry);
router.get('/locations/states', locations.listStates);
router.post('/locations/states', locations.createState);
router.patch('/locations/states', locations.updateState);
router.delete('/locations/states/:id', locations.deleteState);
router.get('/locations/cities', locations.listCities);
router.post('/locations/cities', locations.createCity);
router.patch('/locations/cities', locations.updateCity);
router.delete('/locations/cities/:id', locations.deleteCity);

// Castes & sub-castes
router.get('/castes', castes.listCastes);
router.get('/castes/:id', castes.getCaste);
router.post('/castes', castes.createCaste);
router.patch('/castes', castes.updateCaste);
router.delete('/castes/:id', castes.deleteCaste);
router.get('/sub-castes', castes.listSubCastes);
router.get('/sub-castes/:id', castes.getSubCaste);
router.post('/sub-castes', castes.createSubCaste);
router.patch('/sub-castes', castes.updateSubCaste);
router.delete('/sub-castes/:id', castes.deleteSubCaste);

// CMS — FAQs
router.get('/cms/faqs', cms.listFaqs);
router.post('/cms/faqs', cms.createFaq);
router.patch('/cms/faqs', cms.updateFaq);
router.delete('/cms/faqs/:id', cms.deleteFaq);

// CMS — Stories
router.get('/cms/stories', cms.listStories);
router.post('/cms/stories', cms.createStory);
router.patch('/cms/stories', cms.updateStory);
router.delete('/cms/stories/:id', cms.deleteStory);

// CMS — Blog categories
router.get('/cms/blog-categories', cms.listBlogCategories);
router.post('/cms/blog-categories', cms.createBlogCategory);
router.patch('/cms/blog-categories', cms.updateBlogCategory);
router.delete('/cms/blog-categories/:id', cms.deleteBlogCategory);

// CMS — Blogs
router.get('/cms/blogs', cms.listBlogs);
router.post('/cms/blogs', cms.createBlog);
router.patch('/cms/blogs', cms.updateBlog);
router.delete('/cms/blogs/:id', cms.deleteBlog);

// CMS — Policies
router.get('/cms/policies/:type', cms.getPolicy);
router.post('/cms/policies', cms.upsertPolicy);

// CMS — Counters
router.get('/cms/counters', cms.getCounters);
router.patch('/cms/counters', cms.updateCounters);

// Support
router.get('/reports', admin.listReports);
router.get('/contact-enquiries', admin.listContactEnquiries);
router.patch('/contact-enquiries/:id/resolve', cms.resolveContactEnquiry);
router.delete('/contact-enquiries/:id', cms.deleteContactEnquiry);
router.get('/callback-requests', admin.listCallbackRequests);
router.patch('/callback-requests/:id/resolve', cms.resolveCallback);
router.delete('/callback-requests/:id', cms.deleteCallback);

// Admin messages & chat audit
router.get('/messages', cms.listAdminMessages);
router.post('/messages', cms.sendAdminMessage);
router.delete('/messages/:id', cms.deleteAdminMessage);
router.get('/chats', cms.listUserChats);
router.get('/chats/:userId/:receiverId', cms.getChatThread);

export default router;
