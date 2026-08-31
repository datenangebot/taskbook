<?php

declare(strict_types=1);

namespace Service;

use DateTimeImmutable;
use OCA\Taskbook\Db\Context;
use OCA\Taskbook\Db\ContextMapper;
use OCA\Taskbook\Db\EntryMapper;
use OCA\Taskbook\Exception\ContextNotFoundException;
use OCA\Taskbook\Exception\ValidationException;
use OCA\Taskbook\Service\Clock;
use OCA\Taskbook\Service\ContextService;
use OCP\AppFramework\Db\DoesNotExistException;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

final class ContextServiceTest extends TestCase {
	public function testOtherUserCannotReadAContextById(): void {
		$mapper = $this->createMock(ContextMapper::class);
		$mapper->expects($this->once())
			->method('findForUser')
			->with(7, 'bob')
			->willThrowException(new DoesNotExistException('Context not found.'));

		$this->expectException(ContextNotFoundException::class);
		$this->service($mapper)->find('bob', 7);
	}

	public function testRejectsANonEmojiContextIcon(): void {
		$this->expectException(ValidationException::class);
		$this->service($this->createMock(ContextMapper::class))->create('alice', 'Work', '<strong>Work</strong>', 'w');
	}

	public function testCreateNormalizesAliasAndScopesAvailabilityToAuthenticatedUser(): void {
		$mapper = $this->createMock(ContextMapper::class);
		$mapper->expects($this->once())->method('findAllForUser')->with('alice')->willReturn([new Context()]);
		$mapper->expects($this->once())->method('findByAliasForUser')->with('work', 'alice', null)->willReturn(null);
		$mapper->expects($this->once())->method('create')->with($this->callback(function (Context $context): bool {
			$context->setId(4);
			return $context->getUid() === 'alice' && $context->getAlias() === 'work';
		}))->willReturnCallback(fn (Context $context): Context => $context);

		$response = $this->service($mapper)->create('alice', 'Work', '💼', ' WoRk ');

		$this->assertSame('work', $response['alias']);
	}

	public function testCreateRejectsCaseInsensitiveDuplicateForSameUser(): void {
		$existing = new Context();
		$existing->setId(1);
		$mapper = $this->createMock(ContextMapper::class);
		$mapper->method('findAllForUser')->with('alice')->willReturn([$existing]);
		$mapper->expects($this->once())->method('findByAliasForUser')->with('w', 'alice', null)->willReturn($existing);

		$this->expectException(ValidationException::class);
		$this->expectExceptionMessage('already used');
		$this->service($mapper)->create('alice', 'Weekend', '🏠', 'W');
	}

	public function testAnotherUserMayUseTheSameAlias(): void {
		$mapper = $this->createMock(ContextMapper::class);
		$mapper->method('findAllForUser')->with('bob')->willReturn([new Context()]);
		$mapper->expects($this->once())->method('findByAliasForUser')->with('w', 'bob', null)->willReturn(null);
		$mapper->method('create')->willReturnCallback(function (Context $context): Context {
			$context->setId(9);
			return $context;
		});

		$this->assertSame('w', $this->service($mapper)->create('bob', 'Work', '💼', 'w')['alias']);
	}

	public function testUpdateExcludesTheEditedContextFromDuplicateCheck(): void {
		$context = new Context();
		$context->setId(7);
		$context->setUid('alice');
		$context->setTitle('Work');
		$context->setIcon('💼');
		$context->setAlias('w');
		$context->setCreatedAt(new DateTimeImmutable('2026-08-01T09:00:00Z'));
		$context->setUpdatedAt(new DateTimeImmutable('2026-08-01T09:00:00Z'));
		$mapper = $this->createMock(ContextMapper::class);
		$mapper->method('findForUser')->with(7, 'alice')->willReturn($context);
		$mapper->expects($this->once())->method('findByAliasForUser')->with('w', 'alice', 7)->willReturn(null);
		$mapper->method('updateForUser')->willReturnArgument(0);

		$this->assertSame('w', $this->service($mapper)->update('alice', 7, 'Office', '💼', 'W')['alias']);
	}

	private function service(ContextMapper $mapper): ContextService {
		$clock = $this->createMock(Clock::class);
		$clock->method('nowUtc')->willReturn(new DateTimeImmutable('2026-08-31T09:00:00Z'));
		return new ContextService(
			$mapper,
			$this->createMock(EntryMapper::class),
			$this->createMock(IConfig::class),
			$clock,
		);
	}
}
