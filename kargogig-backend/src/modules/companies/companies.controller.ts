import { Body, Controller, Get, Param, Patch, Post} from "@nestjs/common"
import { CompaniesService } from "./companies.service"
import { CreateCompanyDto } from "./dto/create_company.dto"
import { UpdateCompanyDto } from "./dto/update_company.dto"




@Controller("companies") // api/v1/companies
export class CompaniesController{
    constructor(private readonly companiesService: CompaniesService) {} // create companiesService for service functions


    @Post() // creates company
    create(@Body() dto: CreateCompanyDto){
        return this.companiesService.create(dto);
    }

    @Get() // returns all the companies
    findAll() {
        return this.companiesService.findAll();
    }

    @Get(":id") // returns one company that matches with id
    findOne(@Param("id") id: string) {
        return this.companiesService.findOne(id);
    }

    @Patch(":id") // update company that matches with id
    update(@Param("id") id: string, @Body() dto: UpdateCompanyDto){
        return this.companiesService.update(id, dto);
    }
}