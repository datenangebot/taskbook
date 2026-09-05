<?php

declare(strict_types=1);

namespace OCA\Taskbook\BackgroundJob;

use DateTimeImmutable;
use OCA\Taskbook\Service\OverdueReminderService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\TimedJob;

/** Runs overdue reminder evaluation approximately every five minutes. */
/** @psalm-suppress UnusedClass Registered through appinfo. */
class OverdueReminderJob extends TimedJob {
	public function __construct(
		ITimeFactory $time,
		private OverdueReminderService $overdueReminderService,
	) {
		parent::__construct($time);
		$this->setInterval(5 * 60);
		$this->setAllowParallelRuns(false);
	}

	#[\Override]
	protected function run(mixed $argument): void {
		$this->overdueReminderService->process(DateTimeImmutable::createFromInterface($this->time->getDateTime()));
	}
}
