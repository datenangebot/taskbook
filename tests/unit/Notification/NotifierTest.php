<?php

declare(strict_types=1);

namespace Notification;

use OCA\Taskbook\AppInfo\Application;
use OCA\Taskbook\Notification\Notifier;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\L10N\IFactory;
use OCP\Notification\INotification;
use PHPUnit\Framework\TestCase;

final class NotifierTest extends TestCase {
	public function testPreparesSingularAndPluralCountWithoutEntryContent(): void {
		foreach ([1 => '1 overdue item needs your attention', 4 => '4 overdue items need your attention'] as $count => $subject) {
			$l10n = $this->createMock(IL10N::class);
			$l10n->method('n')->willReturnCallback(static fn (string $singular, string $plural, int $value): string => str_replace('%n', (string)$value, $value === 1 ? $singular : $plural));
			$l10n->method('t')->willReturnArgument(0);
			$factory = $this->createMock(IFactory::class);
			$factory->method('get')->willReturn($l10n);
			$urlGenerator = $this->createMock(IURLGenerator::class);
			$urlGenerator->expects(self::once())->method('linkToRoute')->with('taskbook.page.deepLink', ['path' => 'overview'])->willReturn('/apps/taskbook/overview');
			$urlGenerator->method('imagePath')->willReturn('/apps/taskbook/img/app-dark.svg');
			$urlGenerator->method('getAbsoluteURL')->willReturn('https://cloud.example/apps/taskbook/img/app-dark.svg');
			$notification = $this->notification($count);
			$notification->expects(self::once())->method('setParsedSubject')->with($subject)->willReturnSelf();
			$notification->expects(self::once())->method('setParsedMessage')->with('Open Taskbook Overview to review overdue items.')->willReturnSelf();
			$notification->expects(self::once())->method('setLink')->with('/apps/taskbook/overview')->willReturnSelf();
			$notification->expects(self::once())->method('setIcon')->willReturnSelf();

			self::assertSame($notification, (new Notifier($factory, $urlGenerator))->prepare($notification, 'en'));
		}
	}

	private function notification(int $count): INotification {
		$notification = $this->createMock(INotification::class);
		$notification->method('getApp')->willReturn(Application::APP_ID);
		$notification->method('getObjectType')->willReturn('overdue_reminder');
		$notification->method('getSubject')->willReturn('overdue_reminder');
		$notification->method('getSubjectParameters')->willReturn(['count' => $count]);
		return $notification;
	}
}
