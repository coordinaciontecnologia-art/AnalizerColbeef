CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`reportDate` varchar(20),
	`reportType` varchar(100) DEFAULT 'DATOS GENERALES',
	`imageUrl` text,
	`imageKey` varchar(500),
	`excelSummary` text,
	`reportData` json,
	`status` enum('pending','processing','completed','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
