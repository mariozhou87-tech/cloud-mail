import { parseHTML } from 'linkedom';
import emailUtils from './email-utils.js';

export const WEBSITE_SIGNATURE_URL = 'https://www.sinomudperu.com';
export const WEBSITE_SIGNATURE_TEXT = 'www.sinomudperu.com';
export const SIGNATURE_NAME = 'Mario Zhou';
export const SIGNATURE_COMPANY = 'SINOMUD PERU S.A.C.';
export const SIGNATURE_EMAIL = 'ventas@sinomudperu.com';

const SIGNATURE_SELECTOR = '[data-sinomud-signature]';
const FORWARDED_CONTENT_SELECTOR = '[data-sinomud-forwarded-content]';

function escapeHtml(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function textToHtml(text) {
	return text
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map(line => line ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>')
		.join('');
}

function createSignature(document) {
	const signature = document.createElement('div');
	signature.setAttribute('data-sinomud-signature', 'contact');

	const name = document.createElement('div');
	const strong = document.createElement('strong');
	strong.textContent = SIGNATURE_NAME;
	name.appendChild(strong);
	signature.appendChild(name);

	const company = document.createElement('div');
	company.textContent = SIGNATURE_COMPANY;
	signature.appendChild(company);

	const email = document.createElement('div');
	const emailLink = document.createElement('a');
	emailLink.setAttribute('href', `mailto:${SIGNATURE_EMAIL}`);
	emailLink.textContent = SIGNATURE_EMAIL;
	email.appendChild(emailLink);
	signature.appendChild(email);

	const website = document.createElement('div');
	const link = document.createElement('a');
	link.setAttribute('href', WEBSITE_SIGNATURE_URL);
	link.textContent = WEBSITE_SIGNATURE_TEXT;
	website.appendChild(link);
	signature.appendChild(website);

	return signature;
}

function signatureHtml() {
	return `<div data-sinomud-signature="contact"><div><strong>${escapeHtml(SIGNATURE_NAME)}</strong></div><div>${escapeHtml(SIGNATURE_COMPANY)}</div><div><a href="mailto:${escapeHtml(SIGNATURE_EMAIL)}">${escapeHtml(SIGNATURE_EMAIL)}</a></div><div><a href="${WEBSITE_SIGNATURE_URL}">${WEBSITE_SIGNATURE_TEXT}</a></div></div>`;
}

function findCurrentSignature(document) {
	const signatures = Array.from(document.querySelectorAll(SIGNATURE_SELECTOR))
		.filter(signature => !signature.closest('blockquote') && !signature.closest(FORWARDED_CONTENT_SELECTOR));

	for (const signature of signatures) {
		const websiteLink = signature.querySelector(`a[href="${WEBSITE_SIGNATURE_URL}"]`);
		const emailLink = signature.querySelector(`a[href="mailto:${SIGNATURE_EMAIL}"]`);
		const content = (signature.textContent || '').replace(/\s+/g, ' ').trim();
		const isComplete = (websiteLink?.textContent || '').trim() === WEBSITE_SIGNATURE_TEXT
			&& (emailLink?.textContent || '').trim() === SIGNATURE_EMAIL
			&& content.includes(SIGNATURE_NAME)
			&& content.includes(SIGNATURE_COMPANY);

		if (isComplete) return signature;
		signature.remove();
	}

	return null;
}

function insertSignatureBefore(target, spacer, signature) {
	if (!target?.parentElement) return false;
	target.parentElement.insertBefore(spacer, target);
	target.parentElement.insertBefore(signature, target);
	return true;
}

function appendSignatureHtml(document, sendType) {
	const signature = createSignature(document);
	const spacer = document.createElement('div');
	spacer.appendChild(document.createElement('br'));

	if (sendType === 'reply') {
		const quote = Array.from(document.querySelectorAll('blockquote'))
			.find(item => !item.parentElement?.closest('blockquote'));

		const target = quote?.previousElementSibling || quote;
		if (insertSignatureBefore(target, spacer, signature)) return;
	}

	if (sendType === 'forward') {
		const forwardedContent = document.querySelector(FORWARDED_CONTENT_SELECTOR);
		if (insertSignatureBefore(forwardedContent, spacer, signature)) return;
	}

	document.body.appendChild(spacer);
	document.body.appendChild(signature);
}

export function addWebsiteSignature({ html = '', text = '', sendType = '' } = {}) {
	let signedHtml = html;

	try {
		const wrappedHtml = html.includes('<body')
			? html
			: `<!DOCTYPE html><html><body>${html}</body></html>`;
		const { document } = parseHTML(wrappedHtml);

		if (!document.body.innerHTML.trim() && text.trim()) {
			document.body.innerHTML = textToHtml(text);
		}

		if (!findCurrentSignature(document)) {
			appendSignatureHtml(document, sendType);
		}

		signedHtml = document.toString();
	} catch (error) {
		console.error(error);
		const safeBody = html || textToHtml(text);
		signedHtml = `${safeBody}<div><br></div>${signatureHtml()}`;
	}

	let signedText = emailUtils.htmlToText(signedHtml);
	if (!signedText) {
		const baseText = text.trimEnd();
		const signatureText = `${SIGNATURE_NAME}\n${SIGNATURE_COMPANY}\n${SIGNATURE_EMAIL}\n${WEBSITE_SIGNATURE_TEXT}`;
		signedText = baseText ? `${baseText}\n\n${signatureText}` : signatureText;
	}

	return { html: signedHtml, text: signedText };
}

