CREATE TABLE "daily_waifus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"spawned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_waifus" ADD CONSTRAINT "daily_waifus_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_waifus" ADD CONSTRAINT "daily_waifus_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_waifus_guild_id_idx" ON "daily_waifus" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "daily_waifus_expires_at_idx" ON "daily_waifus" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "daily_waifus_status_idx" ON "daily_waifus" USING btree ("status");--> statement-breakpoint
CREATE INDEX "daily_waifus_guild_status_idx" ON "daily_waifus" USING btree ("guild_id","status");