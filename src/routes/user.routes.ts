import { Router } from 'express';
import * as publicCtrl from '../controllers/public.controller';
import * as profile from '../controllers/profile.controller';
import * as social from '../controllers/social.controller';
import * as message from '../controllers/message.controller';
import * as payment from '../controllers/payment.controller';
import * as upload from '../controllers/upload.controller';
import * as reference from '../controllers/reference.controller';

const router = Router();

// Field option reference (enums for app forms)
router.get('/reference/field-options', reference.getFieldOptions);
router.get('/reference/field-options/:key', reference.getFieldOptionByKey);

// Public reference & CMS
router.get('/locations/countries', publicCtrl.getCountries);
router.get('/locations/countries/:countryId/states', publicCtrl.getStates);
router.get('/locations/states/:stateId/cities', publicCtrl.getCities);

// Castes & sub-castes (REST)
router.get('/castes', publicCtrl.getCastes);
router.get('/castes/:casteId/sub-castes', publicCtrl.getSubCastes);
router.get('/castes/:casteId', publicCtrl.getCasteById);

// Laravel-compatible location & caste aliases (raw JSON arrays)
router.get('/country/data', publicCtrl.getCountriesLegacy);
router.get('/state/:countryId', publicCtrl.getStatesLegacy);
router.get('/city/:stateId', publicCtrl.getCitiesLegacy);
router.get('/subcaste/:casteId', publicCtrl.getSubCastesLegacy);

router.get('/plans', publicCtrl.getPlans);
router.get('/faqs', publicCtrl.getFaqs);
router.get('/blogs', publicCtrl.getBlogs);
router.get('/blogs/:slug', publicCtrl.getBlogBySlug);
router.get('/stories', publicCtrl.getStories);
router.get('/policies/:type', publicCtrl.getPolicy);
router.get('/counters', publicCtrl.getCounters);
router.post('/contact-enquiries', publicCtrl.submitContactEnquiry);

// Discovery
router.get('/dashboard', publicCtrl.getDashboard);
router.get('/profiles/best-matches', publicCtrl.getBestMatchesHandler);
router.get('/profiles/new', publicCtrl.getNewProfilesHandler);
router.get('/profiles/:memberId', publicCtrl.viewProfile);
router.post('/search', publicCtrl.searchProfiles);

// Profile sections
router.get('/me/profile', profile.getMyProfile);
router.get('/me/profile/completion', profile.getProfileCompletionStatus);
router.patch('/me/basic', profile.updateBasic);
router.patch('/me/personal', profile.updatePersonal);
router.patch('/me/about', profile.updateAbout);
router.patch('/me/education', profile.updateEducation);
router.patch('/me/contact-location', profile.updateContactLocation);
router.patch('/me/privacy', profile.updatePrivacy);
router.post('/me/partner-preferences', profile.updatePartnerPreferences);
router.post('/me/family', profile.updateFamily);
router.post('/me/religious', profile.updateReligious);
router.get('/me/trust-badge', profile.getMyTrustBadge);
router.post('/me/trust-badge', profile.submitTrustBadge);
router.get('/me/subscriptions', profile.mySubscription);
router.get('/notifications', profile.notifications);
router.post('/callback-requests', profile.requestCallback);
router.post('/contacts/reveal/:userId', profile.revealContact);
router.get('/contacts/views', profile.contactViewsByMe);
router.get('/contacts/viewed-me', profile.contactViewsOfMe);

// Social
router.post('/interests/:userId', social.sendInterest);
router.post('/interests/:userId/accept', social.acceptInterest);
router.delete('/interests/:interestId', social.removeInterest);
router.get('/interests/received', social.interestsReceived);
router.get('/interests/sent', social.interestsSent);
router.post('/shortlists', social.addShortlist);
router.get('/shortlists', social.getShortlist);
router.delete('/shortlists/:userId', social.removeShortlist);
router.post('/ignores', social.addIgnore);
router.get('/ignores', social.getIgnored);
router.delete('/ignores/:userId', social.removeIgnore);
router.post('/blocks/:userId', social.blockUserHandler);
router.delete('/blocks/:userId', social.unblockUserHandler);
router.get('/blocks', social.getBlockedUsers);
router.get('/gallery-requests/sent', social.galleryRequestsSent);
router.get('/gallery-requests/received', social.galleryRequestsReceived);
router.post('/gallery-requests/:userId', social.sendGalleryRequestHandler);
router.post('/gallery-requests/:userId/accept', social.acceptGalleryRequestHandler);
router.post('/gallery-requests/:userId/reject', social.rejectGalleryRequestHandler);
router.get('/gallery-requests/:userId/gallery', social.viewUserGallery);
router.post('/reports', social.reportProfile);
router.get('/profiles/views/by-me', social.profileViewsByMe);
router.get('/profiles/views/of-me', social.profileViewsOfMe);

// Messaging
router.get('/conversations', message.getConversations);
router.get('/conversations/:userId/messages', message.getMessages);
router.post('/conversations/messages', message.sendMessage);
router.post('/conversations/:userId/read', message.markRead);

// Payments
router.post('/payments/razorpay/order', payment.createOrder);
router.post('/payments/razorpay/verify', payment.verifyPayment);
router.get('/payments/history', payment.paymentHistory);
router.get('/payments/subscription/active', payment.getActiveSubscription);
router.get('/payments/invoices/:invoiceNumber', payment.getInvoice);

// Gallery / photo uploads
router.get('/me/gallery', upload.getGallery);
router.post('/me/photos', upload.uploadPhoto);
router.delete('/me/photos/:field', upload.deletePhoto);

export default router;
