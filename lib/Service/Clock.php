<?php

declare(strict_types=1);

namespace OCA\Taskbook\Service;

use DateTimeImmutable;
use DateTimeZone;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\IDateTimeZone;

/** Centralises the authenticated user's local calendar and UTC timestamps. */
class Clock {
	/** @psalm-suppress PossiblyUnusedMethod Instantiated by Nextcloud dependency injection. */
	public function __construct(
		private ITimeFactory $timeFactory,
		private IDateTimeZone $dateTimeZone,
	) {
	}

	public function userTimeZone(): DateTimeZone {
		return $this->dateTimeZone->getTimeZone();
	}

	public function nowUtc(): DateTimeImmutable {
		return DateTimeImmutable::createFromInterface(
			$this->timeFactory->getDateTime('now', new DateTimeZone('UTC')),
		)->setTimezone(new DateTimeZone('UTC'));
	}

	public function today(): DateTimeImmutable {
		return DateTimeImmutable::createFromInterface(
			$this->timeFactory->getDateTime('today', $this->userTimeZone()),
		)->setTime(0, 0);
	}
}
