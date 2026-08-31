<?php

declare(strict_types=1);

namespace OCA\Taskbook;

/**
 * @psalm-type TaskbookContext = array{id: int, title: string, icon: string, alias: string|null, createdAt: string, updatedAt: string}
 * @psalm-type TaskbookEntry = array{
 *   id: int, text: string, type: 'task'|'appointment'|'note'|'migrated_task'|'irrelevant_task', important: bool,
 *   contextId: int, context: TaskbookContext, referenceType: 'day'|'week'|'month'|'none',
 *   primaryTargetDate: string|null, secondaryTargetDate: string|null, effectiveTargetDate: string|null,
 *   status: 'open'|'completed', completedAt: string|null, createdAt: string, updatedAt: string
 * }
 * @psalm-type TaskbookSettings = array{defaultContextId: int, contexts: list<TaskbookContext>}
 * @psalm-type TaskbookOverview = array{overdue: list<TaskbookEntry>, statistics: array{openItems: int, totalItemsCompleted: int, overdueItems: int, laterItems: int, migratedItems: int}}
 * @psalm-suppress UnusedClass Types are imported into the documented public controllers.
 */
final class ResponseDefinitions {
}
