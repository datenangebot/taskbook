<?php

declare(strict_types=1);

namespace OCA\Taskbook\Notification;

use OCA\Taskbook\AppInfo\Application;
use OCP\IURLGenerator;
use OCP\L10N\IFactory;
use OCP\Notification\INotification;
use OCP\Notification\INotifier;
use OCP\Notification\UnknownNotificationException;

/** Prepares privacy-preserving Taskbook notifications. */
class Notifier implements INotifier {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated through Nextcloud notification discovery. */
	public function __construct(
		private IFactory $l10nFactory,
		private IURLGenerator $urlGenerator,
	) {
	}

	#[\Override]
	public function getID(): string {
		return Application::APP_ID;
	}

	#[\Override]
	public function getName(): string {
		return $this->l10nFactory->get(Application::APP_ID)->t('Taskbook');
	}

	#[\Override]
	public function prepare(INotification $notification, string $languageCode): INotification {
		if ($notification->getApp() !== Application::APP_ID
			|| $notification->getObjectType() !== 'overdue_reminder'
			|| $notification->getSubject() !== 'overdue_reminder') {
			throw new UnknownNotificationException();
		}
		$parameters = $notification->getSubjectParameters();
		$count = $parameters['count'] ?? null;
		if (!is_int($count) || $count < 1) {
			throw new UnknownNotificationException();
		}

		$l = $this->l10nFactory->get(Application::APP_ID, $languageCode);
		$notification->setParsedSubject($l->n(
			'%n overdue item needs your attention',
			'%n overdue items need your attention',
			$count,
		));
		$notification->setParsedMessage($l->t('Open Taskbook Overview to review overdue items.'));
		$notification->setLink($this->urlGenerator->linkToRoute('taskbook.page.deepLink', ['path' => 'overview']));
		$notification->setIcon($this->urlGenerator->getAbsoluteURL(
			$this->urlGenerator->imagePath(Application::APP_ID, 'app-dark.svg'),
		));
		return $notification;
	}
}
