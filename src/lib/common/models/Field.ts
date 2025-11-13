import { z } from 'zod'
import { RepeaterField } from './fields/RepeaterField'
import { GroupField } from './fields/GroupField'
import { TextField } from './fields/TextField'
import { MarkdownField } from './fields/MarkdownField'
import { RichTextField } from './fields/RichTextField'
import { LinkField } from './fields/LinkField'
import { ImageField } from './fields/ImageField'
import { IconField } from './fields/IconField'
import { NumberField } from './fields/NumberField'
import { DateField } from './fields/DateField'
import { UrlField } from './fields/UrlField'
import { PageFieldField } from './fields/PageFieldField'
import { SiteFieldField } from './fields/SiteFieldField'
import { PageField } from './fields/PageField'
import { PageListField } from './fields/PageListField'
import { SliderField } from './fields/SliderField'
import { SwitchField } from './fields/SwitchField'
import { SelectField } from './fields/SelectField'
import { InfoField } from './fields/InfoField'

export const Field = z.discriminatedUnion('type', [
	RepeaterField,
	GroupField,
	TextField,
	MarkdownField,
	RichTextField,
	LinkField,
	ImageField,
	IconField,
	NumberField,
	DateField,
	UrlField,
	PageFieldField,
	SiteFieldField,
	PageField,
	PageListField,
	SliderField,
	SwitchField,
	SelectField,
	InfoField
])

export type Field = z.infer<typeof Field>
