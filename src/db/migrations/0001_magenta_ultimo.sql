CREATE TABLE "blacklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anilist_id" integer,
	"mal_id" integer,
	"name_pattern" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anilist_id" integer,
	"mal_id" integer,
	"name" text NOT NULL,
	"native_name" text,
	"description" text,
	"gender" text,
	"rarity" text NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_anilist_id_unique" UNIQUE("anilist_id"),
	CONSTRAINT "characters_mal_id_unique" UNIQUE("mal_id")
);
--> statement-breakpoint
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blacklists_name_pattern_idx" ON "blacklists" USING btree ("name_pattern");--> statement-breakpoint
CREATE INDEX "blacklists_anilist_id_idx" ON "blacklists" USING btree ("anilist_id");--> statement-breakpoint
CREATE INDEX "blacklists_mal_id_idx" ON "blacklists" USING btree ("mal_id");--> statement-breakpoint
CREATE INDEX "character_images_character_id_idx" ON "character_images" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "characters_name_idx" ON "characters" USING btree ("name");